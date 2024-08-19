const UntisAccessModel = (sequelize, Sequelize) => sequelize.define("untisAccesses", {
    userID: {
        type: Sequelize.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
    },
    name: {
        type: Sequelize.STRING
    },
    urlID: {
        type: Sequelize.STRING,
        unique: true
    },
    school: {
        type: Sequelize.STRING
    },
    domain: {
        type: Sequelize.STRING
    },
    classID: {
        type: Sequelize.STRING
    },
    timezone: {
        type: Sequelize.STRING
    }
})

module.exports = UntisAccessModel
