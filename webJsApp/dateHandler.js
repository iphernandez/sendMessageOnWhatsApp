export class DateHandler {
    week = 7 * 24 * 60 * 60 * 1000;
    day = 24 * 60 * 60 * 1000;

    constructor() {}

    /**
     * Get the next occurrence of a specific weekday from the given date.
     * @param {Date} initialDate - The starting date.
     * @param {number} weekDayIndex - The target day of the week (0=Sun, 1=Mon, ..., 6=Sat).
     * @returns {Date} The next date matching the weekday index.
     */
    getExpectedDate(initialDate, weekDayIndex) {
        let dayOfWeek = initialDate.getDay();
        let addDays =
            dayOfWeek <= weekDayIndex
                ? weekDayIndex - dayOfWeek
                : 7 + dayOfWeek - (dayOfWeek - weekDayIndex) - dayOfWeek;

        initialDate.setDate(initialDate.getDate() + addDays);
        return initialDate;
    }

    /**
     * Get the start of the week for a date, aligned to a specific weekday.
     * @param {Date} dt - The input date.
     * @param {number} weekDayIndex - The weekday to align to.
     * @returns {Date} The start-of-week date.
     */
    startOfWeek(dt, weekDayIndex) {
        const weekday = dt.getDay();
        const resDate = new Date(
            dt.getTime() + (weekDayIndex - weekday) * this.day
        );
        return resDate;
    }

    /**
     * Calculate the number of weeks between two dates.
     * @param {Date} startDate - The start date.
     * @param {Date} endDate - The end date.
     * @param {number} weekDayIndex - The weekday to align weeks to.
     * @returns {number} The number of weeks difference.
     */
    weekDifference(startDate, endDate, weekDayIndex) {
        let weeks = Math.ceil(
            (this.startOfWeek(endDate, weekDayIndex).getTime() -
                this.startOfWeek(startDate, weekDayIndex).getTime()) /
                this.week
        );
        return weeks;
    }
}
