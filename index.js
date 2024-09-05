require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const ics = require('ics')
const jwt = require('jsonwebtoken')
const path = require('path')
const db = require('./models')
const {panelRoute, panelNewRoute, panelNewApiRoute, panelDeleteRoute, panelIdRoute} = require('./controllers/panel')
const {getEvents} = require('./services/untis')
const {logoutRoute, loginApiRoute, loginRoute, accountRoute, panelChangePasswordRoute, deleteAccountRoute} = require('./controllers/authentication')

const UntisAccess = db.untisAccess
const PublicUntisAccess = db.publicUntisAccess
const PrivateUnitsAccess = db.privateUntisAccess
const User = db.user

const app = express()

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/ics/:id', async (req, res) => {
    console.info('Updating Calender')
    const untisAccess = await UntisAccess.findOne({where: {urlId: req.params.id}, include: [ PublicUntisAccess, PrivateUnitsAccess ] })
    const events = await getEvents(untisAccess)
    const {err, value} = ics.createEvents(events)
    if (err) {
        console.error('ICS Error', err)
        return
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.send(value)
    console.info('Updating Completed')
})

app.get('/', async (req, res) => {
    const userCount = await User.count()
    const untisAccessCount = await UntisAccess.count()

    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, (err, _) => {
        const loggedIn = !err;
        res.render('index', {loggedIn, userCount, untisAccessCount})
    })

})

app.get('/login', loginRoute)
app.post('/login-api', loginApiRoute)
app.get('/logout', logoutRoute)
app.get('/account', accountRoute)
app.post('/change-password', panelChangePasswordRoute)
app.post('/delete-account', deleteAccountRoute)
app.get('/panel', panelRoute)
app.post('/panel/new', panelNewRoute)
app.post('/panel/new-api', panelNewApiRoute)
app.post('/panel/delete', panelDeleteRoute)
app.get('/panel/:id', panelIdRoute)

const PORT = process.env.PORT || 3000
db.sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port: ${PORT}`)
    })
})
