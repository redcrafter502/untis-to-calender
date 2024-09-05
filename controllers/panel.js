const db = require('../models')
const jwt = require('jsonwebtoken')
const {randomUUID} = require('crypto')
const {getWebUntis} = require('../services/untis')

const UntisAccess = db.untisAccess
const PublicUntisAccess = db.publicUntisAccess
const PrivateUnitsAccess = db.privateUntisAccess

const panelRoute = async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const untisAccesses = await UntisAccess.findAll({where: {userId: decoded.id}})
        res.render('panel/index', { untisAccesses, apiURL: process.env.API_URL })
    })
}

const panelNewRoute = async (req, res) => {
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
            const schoolYear = await untis.getCurrentSchoolyear().catch(_ => {
                res.redirect('/panel')
            })
            classes = await untis.getClasses(true, schoolYear.id).catch(_ => {
                res.redirect('/panel')
            })
            await untis.logout()
        }
        res.render('panel/new', { type, classes, name, domain, school, timezone })
    })
}

const panelNewApiRoute = async (req, res) => {
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
}

const panelDeleteRoute = async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        await UntisAccess.destroy({where: {untisAccessId: req.body.id, userId: decoded.id}})
        res.redirect('/panel')
    })
}

const panelIdRoute = async (req, res) => {
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
}

module.exports = {panelRoute, panelNewRoute, panelNewApiRoute, panelDeleteRoute, panelIdRoute}