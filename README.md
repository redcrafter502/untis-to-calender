# Untis to Calendar

## Table of Contents

- [What is it good for?](#purpose)
- [How do I run it?](#run)

<a name="porpuse"></a>

## What is it good for?

Untis to Calendar is a project that enables you to sync your timetable from [WebUntis](https://webuntis.com/) with any calendar application of your choice using an iCal link.
Currently, this project supports anonymous login to Untis.
<a name="run"></a>

## How do I run it?

To run the backend and to run the frontend you must have [NodeJs](https://nodejs.org) installed and ideally [pnpm](https://pnpm.io/).

1. Run the command `pnpm install` to install the necessary dependencies.
2. You need to add the environment variables for the required external services:
  - [Hexclave](https://www.hexclave.com/)
  - [Upstash Redis](https://upstash.com/)
  - Look in `.env.example` for the required environment variables.
3. Run the command `pnpm dev` to run the application in developer mode.
