const UserModel = (sequelize, Sequelize) => sequelize.define("users", {
    email: {
        type: Sequelize.STRING,
        unique: true
    },
    password: {
        type: Sequelize.STRING
    }
})

module.exports = UserModel
