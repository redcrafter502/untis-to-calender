import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import ics from 'ics'
import webuntis from 'webuntis'
import momentTimezone from 'moment-timezone'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import {randomUUID} from 'crypto'
import path from 'path'
// @ts-ignore
import db from './models'

const UntisAccess = db.untisAccess
const User = db.user

const PORT = process.env.PORT || 3000
const AUTH_SECRET = process.env.AUTH_SECRET || "no_secret"
const API_URL = process.env.API_URL || "http://localhost:3000"

interface JwtPayload {
    id: number
}

const parseTime = (time: number) => {
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

async function getEvents(school: string, domain: string, classID: string, timezone: string): Promise<Array<any>> {
    const untis = new webuntis.WebUntisAnonymousAuth(school, domain)
    let events: Array<any> = []
    await untis.login().catch(err => {
        console.log('Login Error (getEvents)', err)
    })
    const { startOfCurrentWeek, endOfNextWeek } = getCurrentAndNextWeekRange()
    const timetable = await untis.getTimetableForRange(startOfCurrentWeek, endOfNextWeek, Number(classID), webuntis.WebUntisElementType.CLASS).catch(async (err) => {
        console.log('For Range Error', err)
        let returnTimetable = []
        for (let date = new Date(startOfCurrentWeek); date <= endOfNextWeek; date.setDate(date.getDate() + 1)) {
            const dayTimetable = await untis.getTimetableFor(date, Number(classID), webuntis.WebUntisElementType.CLASS).catch(dayErr => {
                console.log('For Day Error', dayErr)
            })
            if (dayTimetable) {
                returnTimetable.push(...dayTimetable)
            }
        }
        return returnTimetable
    })

    timetable.forEach(lesson => {
        const year = Math.floor(lesson.date / 10000)
        const month = Math.floor((lesson.date % 10000) / 100)
        const day = lesson.date % 100
        const [startHour, startMinute] = parseTime(lesson.startTime)
        const [endHour, endMinute] = parseTime(lesson.endTime)
        let title = 'NO TITLE'
        if (lesson.su[0]) {
            title = lesson.su[0].name
        } else if (lesson.lstext) {
            title = lesson.lstext
        }
        let description = 'NO DESCRIPTION'
        if (lesson.su[0]) {
            description = `${lesson.su[0].longname} - ${lesson.kl.map(k => k.name).join(', ')}`
        } else if (lesson.lstext) {
            description = `${lesson.lstext} - ${lesson.kl[0].name}`
        }
        let location = 'NO LOCATION'
        if (lesson.ro[0]) {
            location = `${lesson.ro[0].longname} (${lesson.ro[0].name})`
        }
        const startUtc = momentTimezone.tz([year, month, day, startHour, startMinute], timezone).utc()
        const endUtc = momentTimezone.tz([year, month, day, endHour, endMinute], timezone).utc()

        events.push({
            start: [startUtc.year(), startUtc.month(), startUtc.date(), startUtc.hour(), startUtc.minute()],
            startInputType: 'utc',
            startOutputType: 'utc',
            end: [endUtc.year(), endUtc.month(), endUtc.date(), endUtc.hour(), endUtc.minute()],
            endInputType: 'utc',
            endOutputType: 'utc',
            title,
            description,
            location,
            status: lesson.code === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
            busyStatus: lesson.code === 'cancelled' ? 'FREE' : 'BUSY'
        })
    })
    await untis.logout()
    return events
}

const app = express()

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/ics/:id', async function (req, res) {
    console.log('Updating Calender')
    const untisAccess = await UntisAccess.findOne({where: {urlID: req.params.id}})
    const events = await getEvents(untisAccess.school, untisAccess.domain, untisAccess.classID, untisAccess.timezone)
    const {error, value} = ics.createEvents(events)
    if (error) {
        console.log('ICS Error', error)
        return
    }
    res.setHeader('Content-Type', 'text/calender; charset=utf-8')
    res.send(value)
    console.log('Updated Successfully')
})

app.get('/', async (req, res) => {
    let loggedIn = false
    const userCount = await User.count()
    const untisAccessCount = await UntisAccess.count()

    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, (err: any, decoded: JwtPayload) => {
        if (err) {
            loggedIn = false
        } else {
            loggedIn = true
        }
        res.render('index', {loggedIn, userCount, untisAccessCount})
    })

})

app.get('/login', (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, (err: any, decoded: JwtPayload) => {
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
    const token = jwt.sign({id: user.id}, AUTH_SECRET, {
        expiresIn: 86400 // 24 hours
    })
    res.cookie('authSession', token)
    res.redirect('/panel')
})

app.get('/logout', (req, res) => {
    res.clearCookie('authSession')
    res.redirect('/')
})

app.get('/panel', async (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        const userID = decoded.id
        const untisAccesses = await UntisAccess.findAll({where: {userID: userID}})
        res.render('panel/index', { untisAccesses, apiURL: API_URL })
    })
})

app.post('/panel/change-password', async (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        const user = await User.findOne({where: { id: decoded.id }})
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
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        const name = req.body.name
        const domain = req.body.domain || 'neilo.webuntis.com'
        const school = req.body.school
        const timezone = req.body.timezone || 'Europe/Berlin'
        const untis = new webuntis.WebUntisAnonymousAuth(school, domain)
        await untis.login().catch(err => {
            res.redirect('/panel')
            return
        })
        // @ts-ignore
        const classes = await untis.getClasses().catch(err => {
            res.redirect('/panel')
            return
        })
        await untis.logout()
        res.render('panel/new', { classes, name, domain, school, timezone })
    })
})

app.post('/panel/new-api', async (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        const urlID = randomUUID()
        await UntisAccess.create({
            name: req.body.name,
            domain: req.body.domain,
            school: req.body.school,
            timezone: req.body.timezone,
            classID: req.body.classes,
            urlID,
            userID: decoded.id
        })
        res.redirect(`/panel/${urlID}`)
    })
})

app.post('/panel/delete', async (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        await UntisAccess.destroy({where: {id: req.body.id, userID: decoded.id}})
        res.redirect('/panel')
    })
})

app.get('/panel/:id', async (req, res) => {
    // @ts-ignore
    jwt.verify(req.cookies.authSession, AUTH_SECRET, async (err: any, decoded: JwtPayload) => {
        if (err) {
            res.redirect('/')
            return
        }
        const untisAccess = await UntisAccess.findOne({where: {urlID: req.params.id, userID: decoded.id}})
        res.render('panel/show', { untisAccess, apiURL: API_URL })
    })
})

db.sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port: ${PORT}`)
    })
})
