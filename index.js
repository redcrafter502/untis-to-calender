require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const ics = require('ics')
const webuntis = require('webuntis')
const momentTimezone = require('moment-timezone')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const path = require('path')
const db = require('./models')

const UntisAccess = db.untisAccess
const PublicUntisAccess = db.publicUntisAccess
const PrivateUnitsAccess = db.privateUntisAccess
const User = db.user

const parseTime = (time) => {
    const hour = Math.floor(time / 100)
    const minute = time % 100
    return [hour, minute]
}

const getCurrentAndNextWeekRange = () => {
    const now = new Date()

    // Calculate the start of the current week (Monday)
    const startOfCurrentWeek = new Date(now)
    startOfCurrentWeek.setDate(now.getDate() - now.getDay() + 1) // Monday

    // Calculate the end of the next week (Sunday)
    const endOfNextWeek = new Date(startOfCurrentWeek)
    endOfNextWeek.setDate(startOfCurrentWeek.getDate() + 13) // Next week's Sunday

    return { startOfCurrentWeek, endOfNextWeek }
}

const getWebUntis = (untisAccess) => {
    if (untisAccess.type === 'public') {
        return new webuntis.WebUntisAnonymousAuth(untisAccess.school, untisAccess.domain)
    } else {
        return new webuntis.WebUntis(untisAccess.school, untisAccess.privateUntisAccess.username, untisAccess.privateUntisAccess.password, untisAccess.domain)
    }
}

const getPublicTimetable = async (startOfCurrentWeek, endOfNextWeek, classId, untis) =>
    await untis.getTimetableForRange(startOfCurrentWeek, endOfNextWeek, classId, webuntis.WebUntisElementType.CLASS).catch(async (err) => {
        console.error('Timetable for range (or parts of it) not available', err)
        console.info('Now requesting each day individually from Untis')
        const returnTimetable = []
        for (let date = new Date(startOfCurrentWeek); date <= endOfNextWeek; date.setDate(date.getDate() + 1)) {
            const dayTimetable = await untis.getTimetableFor(date, classId, webuntis.WebUntisElementType.CLASS).catch(dayErr => {
                console.error('Timetable not available for', date,  dayErr)
            })
            if (dayTimetable) {
                returnTimetable.push(...dayTimetable)
            }
        }
        return returnTimetable
    })

const getOwnTimetable = async (startOfCurrentWeek, endOfNextWeek, untis) =>
    await untis.getOwnTimetableForRange(startOfCurrentWeek, endOfNextWeek).catch(async (err) => {
        console.error('Timetable for range (or parts of it) not available', err)
        console.info('Now requesting each day individually from Untis')
        const returnTimetable = []
        for (let date = new Date(startOfCurrentWeek); date <= endOfNextWeek; date.setDate(date.getDate() + 1)) {
            const dayTimetable = await untis.getOwnTimetableFor(date).catch(dayErr => {
                console.error('Timetable not available for', date,  dayErr)
            })
            if (dayTimetable) {
                returnTimetable.push(...dayTimetable)
            }
        }
        return returnTimetable
    })

const getTimetable = async (startOfCurrentWeek, endOfNextWeek, untisAccess, untis) => {
    if (untisAccess.type === 'public') {
        return await getPublicTimetable(startOfCurrentWeek, endOfNextWeek, untisAccess.publicUntisAccess.classId, untis)
    } else {
        return await getOwnTimetable(startOfCurrentWeek, endOfNextWeek, untis)
    }
}

const getEvents = async (untisAccess) => {
    const untis = getWebUntis(untisAccess)
    await untis.login().catch(err => {
        console.error('Login Error (getEvents)', err)
    })
    const { startOfCurrentWeek, endOfNextWeek } = getCurrentAndNextWeekRange()
    const timetable = await getTimetable(startOfCurrentWeek, endOfNextWeek, untisAccess, untis)

    let homework = {
        records: [],
        homeworks: [],
        teachers: [],
        lessons: []
    }
    if (untisAccess.type === 'private') {
        homework = await untis.getHomeWorksFor(startOfCurrentWeek, endOfNextWeek)
    }

    const events = timetable.map(lesson => {
        const homeworks = []
        homework.homeworks.forEach(iHomework => {
            const homeworkLesson = homework.lessons.filter(l => l.id === iHomework.lessonId)
            const correctLesson = homeworkLesson[0].subject === `${lesson.su[0].longname} (${lesson.su[0].name})`
            if (lesson.date === iHomework.date && correctLesson) {
                homeworks.push(`${iHomework.text} (Start)`)
            }
            if (lesson.date === iHomework.dueDate && correctLesson) {
                homeworks.push(`${iHomework.text} (End)`)
            }
        })

        const year = Math.floor(lesson.date / 10000)
        const month = Math.floor((lesson.date % 10000) / 100)
        const day = lesson.date % 100
        const [startHour, startMinute] = parseTime(lesson.startTime)
        const [endHour, endMinute] = parseTime(lesson.endTime)
        const title = lesson.su[0].name || lesson.lstext || 'No Title'
        const description = `${lesson.su[0].longname} - ${lesson.kl.map(k => k.name).join(', ')}` || `${lesson.lstext} - ${lesson.kl[0].name}` || 'NO DESCRIPTION'
        const location = `${lesson.ro[0].longname} (${lesson.ro[0].name})` || 'NO LOCATION'
        const startUtc = momentTimezone.tz([year, month, day, startHour, startMinute], untisAccess.timezone).utc()
        const endUtc = momentTimezone.tz([year, month, day, endHour, endMinute], untisAccess.timezone).utc()
        const descriptionWithHomework = [description, ...homeworks].join(`\n`)

        return {
            start: [startUtc.year(), startUtc.month(), startUtc.date(), startUtc.hour(), startUtc.minute()],
            startInputType: 'utc',
            startOutputType: 'utc',
            end: [endUtc.year(), endUtc.month(), endUtc.date(), endUtc.hour(), endUtc.minute()],
            endInputType: 'utc',
            endOutputType: 'utc',
            title,
            description: descriptionWithHomework,
            location,
            status: lesson.code === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
            busyStatus: lesson.code === 'cancelled' ? 'FREE' : 'BUSY',
            transp: lesson.code === 'cancelled' ? 'TRANSPARENT' : 'OPAQUE',
            calName: untisAccess.name
        }
    })
    await untis.logout()
    return events
}

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

app.get('/login', (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, (err, _) => {
        if (err) {
            res.render('login')
            return
        }
        res.redirect('/panel')
    })
})

app.post('/login-api', async (req, res) => {
    const user = await User.findOne({where: {email: req.body.email}})
    if (!user) {
        res.redirect('/login')
        return
    }
    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password)
    if (!passwordIsValid) {
        res.redirect('/login')
        return
    }
    const token = jwt.sign({id: user.userId}, process.env.AUTH_SECRET, {
        expiresIn: 86400 // 24 hours
    })
    res.cookie('authSession', token, {
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
    })
    res.redirect('/panel')
})

app.get('/logout', (req, res) => {
    res.clearCookie('authSession')
    res.redirect('/')
})

app.get('/panel', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const untisAccesses = await UntisAccess.findAll({where: {userId: decoded.id}})
        res.render('panel/index', { untisAccesses, apiURL: process.env.API_URL })
    })
})

app.post('/panel/change-password', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const user = await User.findOne({where: { userId: decoded.id }})
        const oldPasswordIsValid = bcrypt.compareSync(req.body.oldPassword, user.password)
        if (!oldPasswordIsValid) {
            res.redirect('/panel')
            return
        }
        if (req.body.newPassword !== req.body.newPasswordConfirmed) {
            res.redirect('/panel')
            return
        }
        user.password = bcrypt.hashSync(req.body.newPassword, 10)
        user.save()
        res.redirect('/panel')
    })
})

app.post('/panel/new', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, _) => {
        if (err) {
            res.redirect('/')
            return
        }
        const type = req.body.type
        const name = req.body.name
        const domain = req.body.domain || 'neilo.webuntis.com'
        const school = req.body.school
        const timezone = req.body.timezone || 'Europe/Berlin'
        if (!(type === 'public' || type === 'private')) {
            res.redirect('/panel')
            return
        }
        let classes = null
        if (type === 'public') {
            const untis = getWebUntis({ school, domain, type: 'public' })
            await untis.login().catch(_ => {
                res.redirect('/panel')
            })
            classes = await untis.getClasses(true, await untis.getCurrentSchoolyear().id).catch(_ => {
                res.redirect('/panel')
            })
            await untis.logout()
        }
        res.render('panel/new', { type, classes, name, domain, school, timezone })
    })
})

app.post('/panel/new-api', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/panel')
            return
        }
        if (!(req.body.type === 'public' || req.body.type === 'private')) {
            res.redirect('/panel')
            return
        }
        const urlId = randomUUID()
        const access = await UntisAccess.create({
            name: req.body.name,
            domain: req.body.domain,
            school: req.body.school,
            timezone: req.body.timezone,
            type: req.body.type,
            urlId,
            userId: decoded.id
        })
        if (req.body.type === 'public') {
            await PublicUntisAccess.create({
                untisAccessId: access.untisAccessId,
                classId: req.body.classes
            })
        } else {
            await PrivateUnitsAccess.create({
                untisAccessId: access.untisAccessId,
                username: req.body.username,
                password: req.body.password
            })
        }
        res.redirect(`/panel/${urlId}`)
    })
})

app.post('/panel/delete', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        await UntisAccess.destroy({where: {untisAccessId: req.body.id, userId: decoded.id}})
        res.redirect('/panel')
    })
})

app.get('/panel/:id', async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const untisAccess = await UntisAccess.findOne(
            {where: {urlId: req.params.id, userId: decoded.id}, include: [ PublicUntisAccess, PrivateUnitsAccess ] }
        )
        res.render('panel/show', { untisAccess, apiURL: process.env.API_URL })
    })
})

const PORT = process.env.PORT || 3000
db.sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port: ${PORT}`)
    })
})
