export class DateHandler {
    week = 7 * 24 * 60 * 60 * 1000;
    day = 24 * 60 * 60 * 1000;

    constructor() { }

    getExpectedDate(initialDate, weekDayIndex) {
        let dayOfWeek = initialDate.getDay();
        let addDays =
            dayOfWeek <= weekDayIndex
                ? weekDayIndex - dayOfWeek
                : 7 + dayOfWeek - (dayOfWeek - weekDayIndex) - dayOfWeek;

        initialDate.setDate(initialDate.getDate() + addDays);

        return initialDate;
    }

    startOfWeek(dt, weekDayIndex) {
        const weekday = dt.getDay();
        const resDate = new Date(dt.getTime() + ((weekDayIndex - weekday) * this.day));
        return resDate;
    }

    weekDifference(startDate, endDate, weekDayIndex) {
        let weeks = Math.ceil((this.startOfWeek(endDate, weekDayIndex).getTime() - this.startOfWeek(startDate, weekDayIndex).getTime()) / this.week);
        return weeks;
    }
}
