'use client'

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RadarUser  = { id: string; username: string }
export type RadarPoint = { subject: string; [userId: string]: string | number }

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  '#2aad66', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadarChart({
  users,
  data,
}: {
  users: RadarUser[]
  data: RadarPoint[]
}) {
  const hasData = users.length > 0 && data.some(d =>
    users.some(u => typeof d[u.id] === 'number' && (d[u.id] as number) > 0)
  )

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        Pas encore de matchs joués
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RechartsRadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }}
        />
        <PolarRadiusAxis
          domain={[0, 10]}
          tickCount={4}
          tick={{ fill: '#52525b', fontSize: 9 }}
          angle={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: any, name: any) => [value == null ? '' : typeof value === 'number' ? value.toFixed(1) : String(value), name]}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
        />
        {users.map((user, i) => (
          <Radar
            key={user.id}
            name={user.username}
            dataKey={user.id}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.18}
            dot={false}
          />
        ))}
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
