import React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import "/src/components/calendarAdmin/CalendarAdmin.css."; // styles ниже

// helpers
function toDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, days) {
  const x = new Date(date);
  x.setDate(x.getDate() + days);
  return x;
}
function mapBookedToRanges(bookedRanges) {
  if (!Array.isArray(bookedRanges)) return [];
  return bookedRanges
    .filter(r => r && r.start && r.end)
    .map(r => {
      const from = toDate(r.start);
      const to = addDays(toDate(r.end), -1); // end — эксклюзивно
      if (to < from) return null;
      return { from, to };
    })
    .filter(Boolean);
}

/**
 * Универсальный календарь админки.
 * props:
 *  - months: сколько месяцев показывать (default 2)
 *  - bookedRanges: [{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }]
 *  - selected: { from?: Date, to?: Date }
 *  - onSelectRange: (range) => void
 *  - readOnly: boolean — если true, выбор дат отключён
 */
export default function AdminCalendar({
  months = 2,
  bookedRanges = [],
  selected,
  onSelectRange,
  readOnly = false,
  weekStartsOn = 1, // Monday
}) {
  const booked = React.useMemo(
    () => mapBookedToRanges(bookedRanges),
    [bookedRanges]
  );

  const mode = readOnly ? "default" : "range";

  return (
    <div className="admin-cal">
      <div className="admin-cal__wrap">
        <div className="admin-cal__header">
          <div className="admin-cal__title">Календарь</div>
        </div>

        <DayPicker
          mode={mode}
          numberOfMonths={months}
          weekStartsOn={weekStartsOn}
          selected={selected}
          onSelect={readOnly ? undefined : onSelectRange}
          // показываем и подсвечиваем занятые ночи
          modifiers={{ booked }}
          modifiersClassNames={{
            booked: "admin-cal__range--booked",
          }}
          // и блокируем их для выбора, если не readOnly
          disabled={readOnly ? undefined : booked}
          className="admin-cal__dp"
        />
      </div>
    </div>
  );
}
