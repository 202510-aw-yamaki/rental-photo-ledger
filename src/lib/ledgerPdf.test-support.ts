export type FileNameTestCase = {
  title: string
  input: string
  expected: string
}

export type DateTimeTestCase = {
  title: string
  input: string | Date
  expected: string
}

export const sanitizeFileNameCases: FileNameTestCase[] = [
  {
    title: "treat empty string as fallback name",
    input: "",
    expected: "未指定"
  },
  {
    title: "trim leading and trailing spaces",
    input: "  property-name-sample  ",
    expected: "property-name-sample"
  },
  {
    title: "replace illegal filename characters",
    input: 'A/B:C*D?E|"F<G>',
    expected: "A_B_C_D_E__F_G_"
  },
  {
    title: "sanitize windows-reserved punctuation",
    input: "name\\with|pipes:colon*star",
    expected: "name_with_pipes_colon_star"
  },
  {
    title: "replace control chars and newlines",
    input: "inside\nphoto\r\nlist",
    expected: "inside_photo_list"
  },
  {
    title: "truncate overly long input",
    input: "A".repeat(180),
    expected: "A".repeat(120)
  },
  {
    title: "avoid leading dot-only output after trim",
    input: "..dots...",
    expected: "dots___"
  }
]

export const dateTimeCases: DateTimeTestCase[] = [
  {
    title: "format ISO8601 input to local timestamp",
    input: "2026-05-01T10:20:30.000Z",
    expected: "2026-05-01 19:20:30"
  },
  {
    title: "accept Date object",
    input: new Date(Date.UTC(2026, 4, 13, 9, 5, 4)),
    expected: "2026-05-13 18:05:04"
  },
  {
    title: "drop milliseconds and keep second precision",
    input: "2026-05-13T00:00:00.999Z",
    expected: "2026-05-13 09:00:00"
  },
  {
    title: "accept date-only input",
    input: "2026-05-13",
    expected: "2026-05-13 09:00:00"
  },
  {
    title: "handle invalid date string as empty",
    input: "invalid-date",
    expected: ""
  }
]
