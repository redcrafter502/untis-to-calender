const webuntis = require('webuntis')

const getWebUntis = (untisAccess) => {
    if (untisAccess.type === 'public') {
        return new webuntis.WebUntisAnonymousAuth(untisAccess.school, untisAccess.domain)
    } else {
        return new webuntis.WebUntis(untisAccess.school, untisAccess.privateUntisAccess.username, untisAccess.privateUntisAccess.password, untisAccess.domain)
    }
}

module.exports = {getWebUntis}