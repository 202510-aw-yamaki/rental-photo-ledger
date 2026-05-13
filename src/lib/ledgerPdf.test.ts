import { describe, expect, it } from "vitest"
import { formatDateTime, sanitizeFileName } from "./ledgerPdf"
import { dateTimeCases, sanitizeFileNameCases } from "./ledgerPdf.test-support"

describe("ledgerPdf pure functions", () => {
  sanitizeFileNameCases.forEach((itCase) => {
    it(`sanitizeFileName: ${itCase.title}`, () => {
      expect(sanitizeFileName(itCase.input)).toBe(itCase.expected)
    })
  })

  dateTimeCases.forEach((itCase) => {
    it(`formatDateTime: ${itCase.title}`, () => {
      expect(formatDateTime(itCase.input)).toBe(itCase.expected)
    })
  })
})
