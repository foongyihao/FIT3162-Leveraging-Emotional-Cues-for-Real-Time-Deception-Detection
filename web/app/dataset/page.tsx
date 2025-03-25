"use client"

import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DatasetPage() {
  const mockHistory = [
    { id: 1, date: "2024-03-20", duration: "2:30", expressions: 15 },
    { id: 2, date: "2024-03-19", duration: "1:45", expressions: 8 },
    { id: 3, date: "2024-03-18", duration: "3:15", expressions: 22 },
  ]

  const emotionData = [
    { name: 'Happiness', value: 35 },
    { name: 'Surprise', value: 20 },
    { name: 'Contempt', value: 15 },
    { name: 'Anger', value: 10 },
    { name: 'Fear', value: 10 },
    { name: 'Neutral', value: 10 },
  ]

  const confidenceData = [
    { expression: 'Happiness', confidence: 92 },
    { expression: 'Surprise', confidence: 85 },
    { expression: 'Contempt', confidence: 78 },
    { expression: 'Anger', confidence: 88 },
    { expression: 'Fear', confidence: 75 },
    { expression: 'Neutral', confidence: 95 },
  ]

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#666']

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="p-6 aspect-square md:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Emotion Distribution</h2>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={emotionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius="80%"
                  fill="#8884d8"
                  dataKey="value"
                >
                  {emotionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          
          <Card className="p-6 aspect-video md:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Prediction Confidence</h2>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="expression" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="confidence" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6 md:col-span-2">
          <div className="space-y-6">
            <Select defaultValue="recent">
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="expressions">Most Expressions</SelectItem>
                <SelectItem value="duration">Longest Duration</SelectItem>
              </SelectContent>
            </Select>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Expressions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockHistory.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.expressions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </main>
  )
}