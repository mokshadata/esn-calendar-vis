// updated for 2026

const dataText = await fetch('./data/dockets-2026-04-20.csv').then((res) => res.text())
const [fields, ...dataList] = dataText.split('\n').map((line) => (line.split(',')))

const transforms = {
  // 'case_numbers': (cell) => (cell.split(',')),
  'Number of Cases': (cell) => (cell * 1),
  'Number of Observers': (cell) => (cell * 1),
}
const computed = (item) => ({
  courtnum: item['Court Name'].split(' JP ')[1].replace('-', ''),
})
const data = dataList.map((row) => (
  Object.fromEntries(
    row.map((val, index) => (
      [fields[index], transforms[fields[index]] && transforms[fields[index]](val) || val]
    ))
  )
)).map((row) => ({...row, ...computed(row)}))

function summarizeDockets(dockets) {
  const baseData = Object.fromEntries(Object.entries(dockets[0]).filter(([key]) => [
    'Court Name', 'Date', 'Day', 'Judge Name', 'Month', 'Week', 'Year', 'courtnum',
  ].includes(key)))

  return {
    docketLinks: dockets.map((docket) => (docket['Docket Link'])),
    startTimes: dockets.map((docket) => (docket['Start Time'])),
    endTimes: dockets.map((docket) => (docket['End Time'])),
    names: dockets.map((docket) => (docket['Name'])),
    caseCount: dockets.reduce((result, current) => (result + current['Number of Cases']), 0),
    ...baseData,
  }
}

const GROUPED_BY_COURT = Object.groupBy(data, (docket) => (docket['courtnum']))
const COUNTED_BY_COURT = Object.fromEntries(
  Object.entries(GROUPED_BY_COURT)
    .map(([courtnum, dockets]) => {
      return [courtnum, summarizeDockets(dockets)]
    })
  )

const groupedData = Object.groupBy(data, (docket) => (`${docket['courtnum']}--${docket['Date']}`))
const countedData = Object.fromEntries(
  Object.entries(groupedData)
    .map(([courtDateGroupKey, dockets]) => {
      return [courtDateGroupKey, summarizeDockets(dockets)]
    })
)
const CASE_COUNTS = Object.values(countedData).map((docketDay) => (docketDay.caseCount))
CASE_COUNTS.sort((a, b) => (a - b))
const MIN_CASE_COUNTS = Math.min(...CASE_COUNTS)
const MAX_CASE_COUNTS = Math.min(Math.max(...CASE_COUNTS), 150)

const COURTS = [1, 2, 3, 4, 5, 6, 7, 8]
  .map((precinct) => [`${precinct}1`, `${precinct}2`])
  .reduce((result, current) => ([...result, ...current]), [])

const DAYS_OF_YEAR_2026 = [...getDaysOfYear('2026')]

const COLORS = [ '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#990000' ]
const EMPTY_COLOR = '#EFEFEF'

const {
  observable,
  addChangeListener,
} = useObservable({
  highlight: {},
}, (target, prop, receiver) => {
  const filteredDockets = () => (target.highlight.date && Object.values(countedData)
    .filter((docketDays) => (docketDays['Date'] === target.highlight.date)) ||
    []
  )
  const courtSummaries = () => {
    if (target.highlight.date) {
      const dockets = filteredDockets()
      return Object.fromEntries(
        COURTS.map((courtnum) => ([
          courtnum,
          dockets.find((docket) => (docket.courtnum === courtnum)) || { ...Object.fromEntries(
            Object.entries(COUNTED_BY_COURT[courtnum]).filter(([key, val]) => ([
              'Court Name', 'Judge Name','courtnum',
            ].includes(key)))
          ), caseCount: 0, },
        ]))
      )
    }
    return Object.fromEntries(
      COURTS.map((courtnum) => ([
        courtnum,
        COUNTED_BY_COURT[courtnum],
      ]))
    )
  }

  const computes = { filteredDockets, courtSummaries, }

  if (prop in computes) {
    return computes[prop]()
  }

  return null
})

function renderDay(dayInfo, courtnum, docketData) {
  const dayWidth = 10
  const base = `<rect
    fill="${docketData && COLORS[calcColorIndex(docketData.caseCount, MAX_CASE_COUNTS)] || (dayInfo.year === 2026 && EMPTY_COLOR) || '#FFF'}"
    class="docket-day"
    data-case-count="${docketData && docketData.caseCount || 0}"
    data-court-name="${docketData && docketData['Court Name']}"
    data-courtnum="${courtnum}"
    data-woy="2026-${dayInfo.weekOfYear}"
    data-wom="${dayInfo.weekOfMonth}"
    data-dow="${dayInfo.dayOfWeek}"
    data-dom="${dayInfo.date}"
    data-month="${dayInfo.month}"
    data-yyyymm="${dayInfo.yyyymm}"
    data-date="${dayInfo.dateStr}"
    data-date-human="${dayInfo.humanDateStr}"
    data-year="${dayInfo.year}"
    x="${dayInfo.weekOfYear * dayWidth}"
    y="${(dayInfo.dayOfWeek - 1) * dayWidth}"
    width="${dayWidth - 2}"
    height="${dayWidth - 2}"
  >
  </rect>`

  if (docketData) {
    return `<a href="${docketData.docketLinks[0]}" target="_blank">${base}</a>`
  }
  return base
}
const MONTH_LABELS = [ 'January', 'February', 'March',
  'April', 'May', 'June',
  'July', 'August', 'September',
  'October', 'November', 'December',
]

function renderMonth(monthInfo, weekOfYearStart) {
  const dayWidth = 10
  let monthWeekStart = weekOfYearStart
  let weeksLength = monthInfo.weeksLength

  if ([6].includes(monthInfo.monthStartDay)) {
    monthWeekStart = monthWeekStart + 1

    if ([0].includes(monthInfo.monthEndDay)) {
      weeksLength = monthInfo.weeksLength - 1
    }
  }

  const xStart = monthWeekStart * dayWidth
  const xEnd = (monthWeekStart + weeksLength) * dayWidth
  const xCenter = (xStart + xEnd) / 2

  return `
  <text x="${xCenter}" y="-${dayWidth / 2}" text-anchor="middle">${MONTH_LABELS[monthInfo.month - 1]}</text>
  <path
    class="docket-month"
    data-yyyymm="${monthInfo.yyyymm}"
    d="
      M${xStart},${(monthInfo.monthStartDayWeekdayIndex - 1) * dayWidth} 
      ${xStart},${5 * dayWidth} 
      ${(monthWeekStart + weeksLength - 1) * dayWidth},${5 * dayWidth} 
      ${(monthWeekStart + weeksLength - 1) * dayWidth},${monthInfo.monthEndDayWeekdayIndex * dayWidth} 
      ${xEnd},${monthInfo.monthEndDayWeekdayIndex * dayWidth} 
      ${xEnd},0 
      ${(monthWeekStart + 1) * dayWidth},0 
      ${(monthWeekStart + 1) * dayWidth},${(monthInfo.monthStartDayWeekdayIndex - 1) * dayWidth} 
      ${xStart},${(monthInfo.monthStartDayWeekdayIndex - 1) * dayWidth}"
  >
  </path>`
}

const MAX_DOCKET_DAY = Object.values(countedData).find((docketDay) => (docketDay.caseCount === MAX_CASE_COUNTS))

const MONTHS_OF_YEAR_2026 = [...getMonthsOfYear('2026')]

const MONTH_STARTS = DAYS_OF_YEAR_2026.filter((day) => day.date === 1).map((day) => (day.weekOfYear))

function renderCourt(courtnum) {

  const yearDays = DAYS_OF_YEAR_2026
    .filter((dayInfo) => (dayInfo.isWeekDay))
    .map((dayInfo) => {
      return renderDay(dayInfo, courtnum, countedData[`${courtnum}--${dayInfo.dateStr}`])}
    )
    .join('')

  const monthBounds = MONTHS_OF_YEAR_2026
    .map((monthInfo, index) => {
      return renderMonth(monthInfo, MONTH_STARTS[index])
    })
    .join('')

  const dayWidth = 10
  const weeks = DAYS_OF_YEAR_2026[DAYS_OF_YEAR_2026.length - 1].weekOfYear

  const courtInfo = Object.values(countedData).find((court) => (court.courtnum === courtnum))
  
  return `<section>
    <h4>${courtInfo['Court Name']}, ${courtInfo['Judge Name']}</h4>
    <svg
      class="court--docket-year"
      data-courtnum="${courtnum}"
      viewBox="-12 -12 ${(weeks + 1) * dayWidth + 12} ${5 * dayWidth + 14}"
    >
      <g transform="translate(-1, -1)">${monthBounds}</g>
      <g>${yearDays}</g>
      <g transform="translate(-8, 0)">
        <text text-anchor="middle" x="0" y="${dayWidth * 0.6}">M</text>
        <text text-anchor="middle" x="0" y="${dayWidth * 1.6}">T</text>
        <text text-anchor="middle" x="0" y="${dayWidth * 2.6}">W</text>
        <text text-anchor="middle" x="0" y="${dayWidth * 3.6}">TH</text>
        <text text-anchor="middle" x="0" y="${dayWidth * 4.6}">F</text>
      </g>
    </svg>
  </section>
  `
}

function calcColorIndex(count, max) {
  return Math.min(Math.ceil(count / max * COLORS.length) - 1, COLORS.length - 1)
}

function calcColor(count, max) {
  return COLORS[calcColorIndex(count, max)] || EMPTY_COLOR
}

function renderSummary() {
  document.querySelector('#summary--totals').innerHTML = Object.entries(observable.courtSummaries).map(([courtnum, summary]) => (
    `<kbd
      data-courtnum="${courtnum}"
    >${summary['Court Name'].replace('Harris County JP ', '')}</kbd>`
  )).join('')

  updateSummary()
}

function updateSummary() {
  const maxCaseCounts = observable.highlight.date && MAX_CASE_COUNTS || Math.max(...Object.entries(observable.courtSummaries).map(([courtnum, summary]) => (summary.caseCount)))
  const courtSummaryEls = document.querySelectorAll('summary kbd')

  const summarySelectedEl = document.querySelector('#summary--selected')

  courtSummaryEls.forEach((courtSummaryEl) => {
    const courtSummary = observable.courtSummaries[courtSummaryEl.dataset.courtnum]

    courtSummaryEl.dataset.count = courtSummary.caseCount
    courtSummaryEl.dataset.colorIndex = calcColorIndex(courtSummary.caseCount, maxCaseCounts)
    courtSummaryEl.style.backgroundColor = calcColor(courtSummary.caseCount, maxCaseCounts)
  })

  if (observable.highlight.date) {
    summarySelectedEl.dataset.label = observable.highlight.date
    return
  }
  summarySelectedEl.dataset.label = `Year-to-Date`
}

function renderVis() {
  document.querySelector('article').innerHTML = COURTS.map(renderCourt).join('')

  document.addEventListener('click', (mouseEvent) => {
    if (mouseEvent.target.tagName === 'rect') {
      mouseEvent.preventDefault()
      mouseEvent.stopPropagation()
      observable.highlight = mouseEvent.target.dataset
    } else {
      observable.highlight = {}
    }
  })
  document.addEventListener('dblclick', (mouseEvent) => {
    if (mouseEvent.target.tagName === 'rect' && mouseEvent.target.parentElement.tagName === 'a') {
      mouseEvent.target.parentElement.dispatchEvent(new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: false,
      }))
    }
  })

  addChangeListener(({ property, target, previousValue, value }) => {
    if (property !== 'highlight') {
      return
    }

    if (value.year === '2026') {
      document.querySelector('#dynamic-styles').innerHTML = `
      rect[data-date="${value.date}"] {
        stroke: blue;
      }
      kbd[data-courtnum="${value.courtnum}"] {
        border: 2px solid blue;
      }
      `
    } else {
      document.querySelector('#dynamic-styles').innerHTML = ``
    }
  })
  
  addChangeListener(({ property, target, previousValue, value }) => {
    updateSummary()
  })

}

renderVis()
renderSummary()