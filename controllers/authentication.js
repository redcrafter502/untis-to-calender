const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../models')

const User = db.user

const loginRoute = (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, (err, _) => {
        if (err) {
            res.render('login')
            return
        }
        res.redirect('/panel')
    })
}

const loginApiRoute = async (req, res) => {
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
}

const logoutRoute = (req, res) => {
    res.clearCookie('authSession')
    res.redirect('/')
}

const accountRoute = (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const user = await User.findByPk(decoded.id)
        res.render('account', { user })
    })
}

const panelChangePasswordRoute = async (req, res) => {
    jwt.verify(req.cookies.authSession, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            res.redirect('/')
            return
        }
        const user = await User.findOne({where: { userId: decoded.id }})
        const oldPasswordIsValid = bcrypt.compareSync(req.body.oldPassword, user.password)
        if (!oldPasswordIsValid) {
            res.redirect('/account')
            return
        }
        if (req.body.newPassword !== req.body.newPasswordConfirmed) {
            res.redirect('/account')
            return
        }
        user.password = bcrypt.hashSync(req.body.newPassword, 10)
        user.save()
        res.redirect('/account')
    })
}

module.exports = {logoutRoute, loginApiRoute, loginRoute, accountRoute, panelChangePasswordRoute}