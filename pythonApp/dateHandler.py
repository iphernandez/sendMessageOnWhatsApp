from datetime import date, timedelta

def getExpectedDate(initialDate, weekDayIndex):
    dayOfWeek=initialDate.weekday()
    addDays=0

    if dayOfWeek <= weekDayIndex:
        addDays=weekDayIndex-dayOfWeek
    else:
        addDays=(7+dayOfWeek)-(dayOfWeek-weekDayIndex)-dayOfWeek

    return initialDate+timedelta(days=addDays)

def weekDifference(startDate, endDate):
    monday1 = (startDate - timedelta(days=startDate.weekday()))
    monday2 = (endDate - timedelta(days=endDate.weekday()))

    difWeeks = int((monday2 - monday1).days / 7)
    print(difWeeks)
    return difWeeks