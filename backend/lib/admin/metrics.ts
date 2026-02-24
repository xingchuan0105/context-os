import { db } from '@/lib/db/schema'

type DayCountRow = {
  day: string
  count: number
}

type TokenSummaryRow = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  messageCount: number
}

type TopTokenUserRow = {
  userId: string
  email: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  messageCount: number
}

type DailyTokenRow = {
  day: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  messageCount: number
}

type RetentionRow = {
  cohortDay: string
  registeredUsers: number
  retainedD1: number
  retainedD7: number
}

export type AdminCountPoint = {
  date: string
  value: number
}

export type AdminTokenPoint = {
  date: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  messageCount: number
}

export type AdminTopTokenUser = {
  userId: string
  email: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  messageCount: number
}

export type AdminRetentionPoint = {
  cohortDate: string
  registeredUsers: number
  retainedD1: number
  retainedD7: number
  d1Rate: number
  d7Rate: number
}

export type AdminMetricsOverview = {
  generatedAt: string
  range: {
    days: number
    from: string
    to: string
    timezone: 'UTC'
  }
  users: {
    total: number
    newToday: number
    newLast7Days: number
    newLast30Days: number
    dailyNew: AdminCountPoint[]
  }
  files: {
    total: number
    totalSizeBytes: number
    statusCounts: {
      queued: number
      processing: number
      completed: number
      failed: number
    }
    successRate: number
    newToday: number
    newLast7Days: number
    newLast30Days: number
    dailyUploads: AdminCountPoint[]
  }
  tokens: {
    estimated: boolean
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    window1d: TokenSummaryRow
    window7d: TokenSummaryRow
    window30d: TokenSummaryRow
    daily: AdminTokenPoint[]
    topUsers: AdminTopTokenUser[]
  }
  activity: {
    dau: number
    wau: number
    mau: number
    dailyActiveUsers: AdminCountPoint[]
    retention: {
      d1: number
      d7: number
    }
    retentionSeries: AdminRetentionPoint[]
  }
  meta: {
    queryDurationMs: number
    cache: {
      hit: boolean
      stale: boolean
      ttlSeconds: number
    }
  }
}

const ACTIVITY_UNION_SQL = `
  SELECT user_id, date(created_at) AS day FROM documents
  UNION
  SELECT user_id, date(updated_at) AS day FROM notes
  UNION
  SELECT user_id, date(updated_at) AS day FROM quick_notes
  UNION
  SELECT s.user_id AS user_id, date(m.created_at) AS day
  FROM chat_messages m
  INNER JOIN chat_sessions s ON s.id = m.session_id
`

function asNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function roundTo(value: number, digits: number = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function ratioPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return roundTo((numerator / denominator) * 100, 2)
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function utcDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return toDateOnly(date)
}

function buildDateSeries(days: number): string[] {
  const series: string[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    series.push(utcDateDaysAgo(offset))
  }
  return series
}

function lookbackModifier(days: number): string {
  const safeDays = Math.max(1, days)
  return `-${safeDays - 1} day`
}

function buildCountSeries(days: number, rows: DayCountRow[]): AdminCountPoint[] {
  const rowMap = new Map(rows.map((row) => [row.day, asNumber(row.count)]))
  return buildDateSeries(days).map((date) => ({
    date,
    value: rowMap.get(date) || 0,
  }))
}

function normalizeTokenSummary(row?: Partial<TokenSummaryRow>): TokenSummaryRow {
  const promptTokens = asNumber(row?.promptTokens)
  const completionTokens = asNumber(row?.completionTokens)
  const totalTokens = asNumber(row?.totalTokens) || promptTokens + completionTokens
  const messageCount = asNumber(row?.messageCount)

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    messageCount,
  }
}

function getTokenWindow(days: number): TokenSummaryRow {
  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN role = 'user' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS promptTokens,
        COALESCE(SUM(CASE WHEN role = 'assistant' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS completionTokens,
        COALESCE(SUM(CAST((LENGTH(content) + 3) / 4 AS INTEGER)), 0) AS totalTokens,
        COUNT(*) AS messageCount
      FROM chat_messages
      WHERE date(created_at) >= date('now', ?)
    `
    )
    .get(lookbackModifier(days)) as Partial<TokenSummaryRow> | undefined

  return normalizeTokenSummary(row)
}

function getActiveUserCount(days: number): number {
  const row = db
    .prepare(
      `
      WITH activity AS (
        ${ACTIVITY_UNION_SQL}
      )
      SELECT COALESCE(COUNT(DISTINCT user_id), 0) AS count
      FROM activity
      WHERE day >= date('now', ?)
    `
    )
    .get(lookbackModifier(days)) as { count: number } | undefined

  return asNumber(row?.count)
}

export function getAdminMetricsOverview(input?: {
  days?: number
  topUsersLimit?: number
}): AdminMetricsOverview {
  const startedAt = Date.now()

  const days = Math.max(1, Math.min(90, Math.floor(input?.days ?? 30)))
  const topUsersLimit = Math.max(5, Math.min(50, Math.floor(input?.topUsersLimit ?? 10)))
  const lookback = lookbackModifier(days)

  const userSummary = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END), 0) AS newToday,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-6 day') THEN 1 ELSE 0 END), 0) AS newLast7Days,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-29 day') THEN 1 ELSE 0 END), 0) AS newLast30Days
      FROM users
    `
    )
    .get() as {
      total: number
      newToday: number
      newLast7Days: number
      newLast30Days: number
    }

  const userDailyRows = db
    .prepare(
      `
      SELECT date(created_at) AS day, COUNT(*) AS count
      FROM users
      WHERE date(created_at) >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY day ASC
    `
    )
    .all(lookback) as DayCountRow[]

  const fileSummary = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(file_size), 0) AS totalSizeBytes,
        COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
        COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) AS processing,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END), 0) AS newToday,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-6 day') THEN 1 ELSE 0 END), 0) AS newLast7Days,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-29 day') THEN 1 ELSE 0 END), 0) AS newLast30Days
      FROM documents
    `
    )
    .get() as {
      total: number
      totalSizeBytes: number
      queued: number
      processing: number
      completed: number
      failed: number
      newToday: number
      newLast7Days: number
      newLast30Days: number
    }

  const fileDailyRows = db
    .prepare(
      `
      SELECT date(created_at) AS day, COUNT(*) AS count
      FROM documents
      WHERE date(created_at) >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY day ASC
    `
    )
    .all(lookback) as DayCountRow[]

  const tokenAllTime = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN role = 'user' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS promptTokens,
        COALESCE(SUM(CASE WHEN role = 'assistant' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS completionTokens,
        COALESCE(SUM(CAST((LENGTH(content) + 3) / 4 AS INTEGER)), 0) AS totalTokens,
        COUNT(*) AS messageCount
      FROM chat_messages
    `
    )
    .get() as Partial<TokenSummaryRow>

  const tokenDailyRows = db
    .prepare(
      `
      SELECT
        date(created_at) AS day,
        COALESCE(SUM(CASE WHEN role = 'user' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS promptTokens,
        COALESCE(SUM(CASE WHEN role = 'assistant' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS completionTokens,
        COALESCE(SUM(CAST((LENGTH(content) + 3) / 4 AS INTEGER)), 0) AS totalTokens,
        COUNT(*) AS messageCount
      FROM chat_messages
      WHERE date(created_at) >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY day ASC
    `
    )
    .all(lookback) as DailyTokenRow[]

  const tokenTopUsersRows = db
    .prepare(
      `
      SELECT
        s.user_id AS userId,
        u.email AS email,
        COALESCE(SUM(CASE WHEN m.role = 'user' THEN CAST((LENGTH(m.content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS promptTokens,
        COALESCE(SUM(CASE WHEN m.role = 'assistant' THEN CAST((LENGTH(m.content) + 3) / 4 AS INTEGER) ELSE 0 END), 0) AS completionTokens,
        COALESCE(SUM(CAST((LENGTH(m.content) + 3) / 4 AS INTEGER)), 0) AS totalTokens,
        COUNT(*) AS messageCount
      FROM chat_messages m
      INNER JOIN chat_sessions s ON s.id = m.session_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE date(m.created_at) >= date('now', '-29 day')
      GROUP BY s.user_id, u.email
      ORDER BY totalTokens DESC, messageCount DESC
      LIMIT ?
    `
    )
    .all(topUsersLimit) as TopTokenUserRow[]

  const dailyActivityRows = db
    .prepare(
      `
      WITH activity AS (
        ${ACTIVITY_UNION_SQL}
      )
      SELECT day, COUNT(DISTINCT user_id) AS count
      FROM activity
      WHERE day >= date('now', ?)
      GROUP BY day
      ORDER BY day ASC
    `
    )
    .all(lookback) as DayCountRow[]

  const retentionRows = db
    .prepare(
      `
      WITH activity AS (
        ${ACTIVITY_UNION_SQL}
      ),
      cohorts AS (
        SELECT id AS user_id, date(created_at) AS cohort_day
        FROM users
        WHERE date(created_at) >= date('now', ?)
      ),
      cohort_stats AS (
        SELECT
          c.cohort_day AS cohortDay,
          COUNT(*) AS registeredUsers,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM activity a
            WHERE a.user_id = c.user_id
              AND a.day = date(c.cohort_day, '+1 day')
          ) THEN 1 ELSE 0 END) AS retainedD1,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM activity a
            WHERE a.user_id = c.user_id
              AND a.day = date(c.cohort_day, '+7 day')
          ) THEN 1 ELSE 0 END) AS retainedD7
        FROM cohorts c
        GROUP BY c.cohort_day
      )
      SELECT cohortDay, registeredUsers, retainedD1, retainedD7
      FROM cohort_stats
      ORDER BY cohortDay ASC
    `
    )
    .all(lookback) as RetentionRow[]

  const dailyUsers = buildCountSeries(days, userDailyRows)
  const dailyUploads = buildCountSeries(days, fileDailyRows)
  const dailyActiveUsers = buildCountSeries(days, dailyActivityRows)

  const dailyTokenMap = new Map(tokenDailyRows.map((row) => [row.day, row]))
  const dailyTokens: AdminTokenPoint[] = buildDateSeries(days).map((date) => {
    const row = dailyTokenMap.get(date)
    return {
      date,
      promptTokens: asNumber(row?.promptTokens),
      completionTokens: asNumber(row?.completionTokens),
      totalTokens: asNumber(row?.totalTokens),
      messageCount: asNumber(row?.messageCount),
    }
  })

  const retentionSeries: AdminRetentionPoint[] = retentionRows.map((row) => {
    const registeredUsers = asNumber(row.registeredUsers)
    const retainedD1 = asNumber(row.retainedD1)
    const retainedD7 = asNumber(row.retainedD7)
    return {
      cohortDate: row.cohortDay,
      registeredUsers,
      retainedD1,
      retainedD7,
      d1Rate: ratioPercent(retainedD1, registeredUsers),
      d7Rate: ratioPercent(retainedD7, registeredUsers),
    }
  })

  const yesterday = utcDateDaysAgo(1)
  const sevenDaysAgo = utcDateDaysAgo(7)

  const d1Eligible = retentionSeries.filter((item) => item.cohortDate <= yesterday)
  const d7Eligible = retentionSeries.filter((item) => item.cohortDate <= sevenDaysAgo)

  const d1Registered = d1Eligible.reduce((acc, item) => acc + item.registeredUsers, 0)
  const d1Retained = d1Eligible.reduce((acc, item) => acc + item.retainedD1, 0)
  const d7Registered = d7Eligible.reduce((acc, item) => acc + item.registeredUsers, 0)
  const d7Retained = d7Eligible.reduce((acc, item) => acc + item.retainedD7, 0)

  const duration = Date.now() - startedAt
  const dateSeries = buildDateSeries(days)

  return {
    generatedAt: new Date().toISOString(),
    range: {
      days,
      from: dateSeries[0],
      to: dateSeries[dateSeries.length - 1],
      timezone: 'UTC',
    },
    users: {
      total: asNumber(userSummary?.total),
      newToday: asNumber(userSummary?.newToday),
      newLast7Days: asNumber(userSummary?.newLast7Days),
      newLast30Days: asNumber(userSummary?.newLast30Days),
      dailyNew: dailyUsers,
    },
    files: {
      total: asNumber(fileSummary?.total),
      totalSizeBytes: asNumber(fileSummary?.totalSizeBytes),
      statusCounts: {
        queued: asNumber(fileSummary?.queued),
        processing: asNumber(fileSummary?.processing),
        completed: asNumber(fileSummary?.completed),
        failed: asNumber(fileSummary?.failed),
      },
      successRate: ratioPercent(asNumber(fileSummary?.completed), asNumber(fileSummary?.total)),
      newToday: asNumber(fileSummary?.newToday),
      newLast7Days: asNumber(fileSummary?.newLast7Days),
      newLast30Days: asNumber(fileSummary?.newLast30Days),
      dailyUploads,
    },
    tokens: {
      estimated: true,
      totalPromptTokens: asNumber(tokenAllTime?.promptTokens),
      totalCompletionTokens: asNumber(tokenAllTime?.completionTokens),
      totalTokens: asNumber(tokenAllTime?.totalTokens),
      window1d: getTokenWindow(1),
      window7d: getTokenWindow(7),
      window30d: getTokenWindow(30),
      daily: dailyTokens,
      topUsers: tokenTopUsersRows.map((row) => ({
        userId: row.userId,
        email: row.email,
        promptTokens: asNumber(row.promptTokens),
        completionTokens: asNumber(row.completionTokens),
        totalTokens: asNumber(row.totalTokens),
        messageCount: asNumber(row.messageCount),
      })),
    },
    activity: {
      dau: getActiveUserCount(1),
      wau: getActiveUserCount(7),
      mau: getActiveUserCount(30),
      dailyActiveUsers,
      retention: {
        d1: ratioPercent(d1Retained, d1Registered),
        d7: ratioPercent(d7Retained, d7Registered),
      },
      retentionSeries,
    },
    meta: {
      queryDurationMs: duration,
      cache: {
        hit: false,
        stale: false,
        ttlSeconds: 0,
      },
    },
  }
}

