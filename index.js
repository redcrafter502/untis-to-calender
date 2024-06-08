const express = require('express')
const ics = require('ics')
const webuntis = require('webuntis')
const momentTimezone = require('moment-timezone')
require('dotenv').config()

const untis = new webuntis.WebUntisAnonymousAuth(process.env.SCHOOL, process.env.DOMAIN)

if (process.argv.includes('classes')) {
    getClasses()
}

console.log(process.env.TIMEZONE)

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

async function getClasses() {
    await untis.login().catch(err => {
        console.log('Error', err)
    })
    const classes = await untis.getClasses()
    classes.forEach(c => {
        console.log(c.name, c.id)
    })
    untis.logout()
}

async function getEvents() {
    let events = []
    await untis.login().catch(err => {
        console.log('Error', err)
    })
    const { startOfCurrentWeek, endOfNextWeek } = getCurrentAndNextWeekRange();
    const timetable = await untis.getTimetableForRange(startOfCurrentWeek, endOfNextWeek, process.env.CLASS_ID, webuntis.WebUntisElementType.CLASS)

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
        const startUtc = momentTimezone.tz([year, month, day, startHour, startMinute], process.env.TIMEZONE).utc()
        const endUtc = momentTimezone.tz([year, month, day, endHour, endMinute], process.env.TIMEZONE).utc()

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
    untis.logout()
    return events
}

const app = express()

app.get('/ics', async function (req, res) {
    console.log('Updating Calender')
    const events = await getEvents()
    const {error, value } = ics.createEvents(events)
    if (error) {
        console.log(error)
        return
    }
    res.setHeader('Content-Type', 'text/calender; charset=utf-8')
    res.send(value)


})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`)
})
