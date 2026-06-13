'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

export type MatchLineUser  = { id: string; username: string }
export type MatchLinePoint = { label: string; nations: string; [key: string]: string | number }

const COLORS = [
  '#2aad66', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
]

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ dataKey: string; name: string; value: number; color: string; payload: MatchLinePoint }>
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div style={{
      backgroundColor: '#18181b',
      border: '1px solid #3f3f46',
      borderRadius: '10px',
      padding: '10px 14px',
      minWidth: '160px',
    }}>
      <p style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
        {point.nations}
      </p>
      {[...payload].sort((a, b) => b.value - a.value).map(entry => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
          <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
            {entry.name}
            <span style={{ color: '#a1a1aa', marginLeft: '4px' }}>·</span>
            <strong style={{ color: '#e4e4e7', marginLeft: '4px' }}>{entry.value} pts</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MatchLineChart({
  users,
  data,
}: {
  users: MatchLineUser[]
  data: MatchLinePoint[]
}) {
  if (!data.length || !users.length) return (
    <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
      Aucun match terminé pour le moment
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={{ stroke: '#3f3f46' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
          formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
        />
        {users.map((u, i) => (
          <Line
            key={u.id}
            type="monotone"
            dataKey={u.id}
            name={u.username}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: COLORS[i % COLORS.length] }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
