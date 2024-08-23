const UntisAccessModel = (sequelize, Sequelize) => sequelize.define('untisAccesses', {
    untisAccessId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: Sequelize.INTEGER,
        references: { model: 'users', key: 'userId' },
        onDelete: 'CASCADE',
        allowNull: false
    },
    type: {
        type: Sequelize.ENUM('public', 'private'),
        allowNull: false
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    urlId: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    school: {
        type: Sequelize.STRING,
        allowNull: false
    },
    domain: {
        type: Sequelize.STRING,
        allowNull: false
    },
    /*classID: {
        type: Sequelize.STRING
    },*/
    timezone: {
        type: Sequelize.STRING,
        allowNull: false
    }
})

module.exports = UntisAccessModel
