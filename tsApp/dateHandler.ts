export class DateHandler {
    private week = 7 * 24 * 60 * 60 * 1000;
    private day = 24 * 60 * 60 * 1000;
    public constructor() {}

    public getExpectedDate(initialDate: Date, weekDayIndex: number): Date {
        let dayOfWeek = initialDate.getDay();
        let addDays =
            dayOfWeek <= weekDayIndex
                ? weekDayIndex - dayOfWeek
                : 7 + dayOfWeek - (dayOfWeek - weekDayIndex) - dayOfWeek;

        initialDate.setDate(initialDate.getDate() + addDays);

        return initialDate;
    }

    private startOfWeek(dt: Date): Date {
        const weekday = dt.getDay();
        return new Date(dt.getTime() - Math.abs(0 - weekday) * this.day);
    }
    public weekDifference(startDate: Date, endDate: Date): number {
        return Math.ceil(
            (this.startOfWeek(endDate).getTime() - this.startOfWeek(startDate).getTime()) /
                this.week
        );
    }
}
