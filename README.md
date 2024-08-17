# Untis to Calender

## Table of Contents
* [What is it good for?](#purpose)
* [How do I run it?](#run)

<a name="porpuse"></a>
## What is it good for?
Untis to Calendar is a project that enables you to sync your timetable from [WebUntis](https://webuntis.com/)  with any calendar application of your choice using an iCal link.
Currently, this project supports anonymous login to Untis.
<a name="run"></a>
## How do I run it?
To run the backend and to run the frontend you must have installed [NodeJs](https://nodejs.org).
1. Run the command `npm install` to install the necessary dependencies.
2. Create a `.env` file with the following configurations:
    * Here you can change the port. Example: `PORT=2000`
    * You need to specify an auth secret for jsonwebtoken. Example: `AUTH_SECRET="supersecretsecret"`
    * You need to define an url to be displayed in the ui. Example: `API_URL=http://localhost:3000`
    * You need to set the data for your instance of PostgreSQL. Example: `DB_USERNAME="postgres"
DB_PASSWORD="password"
DB_DATABASE="untis-to-calender"
DB_HOST="localhost"
DB_DIALECT="postgres"
DB_POOL_MAX=5
DB_POOL_MIN=0
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000`
3. Run the command `npm run start` to run the application.
