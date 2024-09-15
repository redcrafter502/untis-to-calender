const webuntis = require('webuntis')
const momentTimezone = require("moment-timezone");

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
    let examEvents = []
    if (untisAccess.type === 'private') {
        homework = await untis.getHomeWorksFor(startOfCurrentWeek, endOfNextWeek)

        const { startDate, endDate } = await untis.getCurrentSchoolyear()
        const exams = await untis.getExamsForRange(startDate, endDate)
        examEvents = exams.map(exam => {
            const year = Math.floor(exam.examDate / 10000)
            const month = Math.floor((exam.examDate % 10000) / 100)
            const day = exam.examDate % 100
            const [startHour, startMinute] = parseTime(exam.startTime)
            const [endHour, endMinute] = parseTime(exam.endTime)
            const startUtc = momentTimezone.tz([year, month - 1, day, startHour, startMinute], untisAccess.timezone).utc()
            const endUtc = momentTimezone.tz([year, month - 1, day, endHour, endMinute], untisAccess.timezone).utc()
            const title = `${exam.name} (${exam.examType})` || 'NO TITLE'
            const description = `${exam.name} (${exam.subject} - ${exam.studentClass.join(' ')} - ${exam.teachers.join(' ')}) ${exam.text}` || 'NO DESCRIPTION'
            const location = exam.rooms.join(' ') || 'NO LOCATION'

            return {
                start: [startUtc.year(), startUtc.month() + 1, startUtc.date(), startUtc.hour(), startUtc.minute()],
                startInputType: 'utc',
                startOutputType: 'utc',
                end: [endUtc.year(), endUtc.month() + 1, endUtc.date(), endUtc.hour(), endUtc.minute()],
                endInputType: 'utc',
                endOutputType: 'utc',
                title,
                description,
                location,
                status: 'CONFIRMED',
                busyStatus: 'BUSY',
                transp: 'OPAQUE',
                calName: untisAccess.name
            }
        })
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
        const title = lesson.su[0].name || lesson.lstext || 'NO TITLE'
        const description = `${lesson.su[0].longname} - ${lesson.kl.map(k => k.name).join(', ')}` || `${lesson.lstext} - ${lesson.kl[0].name}` || 'NO DESCRIPTION'
        const location = `${lesson.ro[0].longname} (${lesson.ro[0].name})` || 'NO LOCATION'
        const startUtc = momentTimezone.tz([year, month - 1, day, startHour, startMinute], untisAccess.timezone).utc()
        const endUtc = momentTimezone.tz([year, month - 1, day, endHour, endMinute], untisAccess.timezone).utc()
        const descriptionWithHomework = [description, ...homeworks].join(`\n`)
        const titleWithInfoMark = title + (homeworks.length > 0 ? ' ℹ️' : '')

        return {
            start: [startUtc.year(), startUtc.month() + 1, startUtc.date(), startUtc.hour(), startUtc.minute()],
            startInputType: 'utc',
            startOutputType: 'utc',
            end: [endUtc.year(), endUtc.month() + 1, endUtc.date(), endUtc.hour(), endUtc.minute()],
            endInputType: 'utc',
            endOutputType: 'utc',
            title: titleWithInfoMark,
            description: descriptionWithHomework,
            location,
            status: lesson.code === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
            busyStatus: lesson.code === 'cancelled' ? 'FREE' : 'BUSY',
            transp: lesson.code === 'cancelled' ? 'TRANSPARENT' : 'OPAQUE',
            calName: untisAccess.name
        }
    })
    await untis.logout()
    return [...events, ...examEvents]
}

module.exports = {getWebUntis, getEvents}