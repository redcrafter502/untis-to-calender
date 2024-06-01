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
    * Define the domain of the WebUntis for your school.  Use the domain from the address bar when accessing WebUntis, without `http://` or `https://`. Example: `DOMAIN="neilo.webuntis.com"
    * Define the school ID. This can be found in the URL bar when accessing WebUntis. Replace every + with a space. If needed, you can ask ChatGPT for assistance in finding the School ID for the WebUntis API for your school. Example: `SCHOOL="your school id"`
    * Specify the class ID. You can obtain the class ID by running `npm run start classes`. Example: `CLASS_ID=1111`
3. Run the command `npm run start` to run the application.
