const { Sequelize, DataTypes } = require('sequelize')

const UserModel = require('./user.model.js')
const UntisAccessModel = require('./untisAccess.model.js')

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    pool: {
        max: parseInt(process.env.DB_POOL_MAX),
        min: parseInt(process.env.DB_POOL_MIN),
        acquire: parseInt(process.env.DB_POOL_ACQUIRE),
        idle: parseInt(process.env.DB_POOL_IDLE)
    },
    logging: console.log,
    logQueryParameters: false
})

const db = {
    sequelize,
    Sequelize,
    user: UserModel(sequelize, Sequelize),
    untisAccess: UntisAccessModel(sequelize, Sequelize)
}

db.untisAccess.belongsTo(db.user, {
    foreignKey: 'userID'
})

module.exports = db
