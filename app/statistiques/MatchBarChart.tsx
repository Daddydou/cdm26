'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = [
  '#2aad66', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
]

export type BarUser  = { id: string; username: string }
export type BarPoint = { label: string; [key: string]: string | number }

export default function MatchBarChart({
  users,
  data,
}: {
  users: BarUser[]
  data: BarPoint[]
}) {
  if (!data.length || !users.length) return null

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={52}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          cursor={{ fill: '#ffffff08' }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
        />
        {users.map((u, i) => (
          <Bar
            key={u.id}
            dataKey={u.id}
            name={u.username}
            fill={COLORS[i % COLORS.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
