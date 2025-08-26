import React from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar
} from 'recharts'

export default function ChartCard({ title, data, kind = 'line', x='label', y='value' }){
  return (
    <div className="card" style={{flex:1, minWidth: 320}}>
      <h3>{title}</h3>
      <div style={{width:'100%', height:260}}>
        <ResponsiveContainer>
          {kind === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} /><YAxis />
              <Tooltip /><Legend />
              <Bar dataKey={y} />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} /><YAxis />
              <Tooltip /><Legend />
              <Line type="monotone" dataKey={y} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
