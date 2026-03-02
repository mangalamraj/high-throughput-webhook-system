"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

interface TimeSeriesPoint {
  minute: string;
  count: number;
}

interface BreakdownItem {
  type: string;
  count: number;
}

interface FailureItem {
  id: string;
  eventId: string;
  reason: string;
  timestamp: string;
}

interface WebhookStats {
  received: number;
  processed: number;
  failed: number;
  timeSeries: TimeSeriesPoint[];
  breakdown: BreakdownItem[];
  recentFailures: FailureItem[];
}

export default function WebhookDashboard() {
  const [data, setData] = useState<WebhookStats | null>(null);
  const [error, setError] = useState(false);

  const API_URL = "http://localhost:8000/api/v1/stats";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Backend offline");
        const result = await response.json();
        setData(result);
        setError(false);
      } catch (err) {
        console.error("Polling error:", err);
        setError(true);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 text-red-600">
        <AlertCircle className="mr-2" /> Backend Server Offline - Check your
        Node.js logs.
      </div>
    );

  if (!data)
    return <div className="p-10 text-center">Loading System Metrics...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6  min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Webhook Operations</h1>
          <p className="text-slate-500 text-sm">
            Real-time ingestion monitoring
          </p>
        </div>
        <Badge variant="outline" className="bg-white gap-1 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Received"
          value={data.received}
          icon={<Activity className="text-blue-500" />}
        />
        <MetricCard
          title="Processed"
          value={data.processed}
          icon={<CheckCircle className="text-green-500" />}
        />
        <MetricCard
          title="Failed"
          value={data.failed}
          icon={<AlertCircle className="text-red-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Traffic (Last 30 Mins)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeSeries}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis dataKey="minute" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Event Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.breakdown}>
                <XAxis dataKey="type" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.breakdown.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Processing Failures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="overflow-y-scroll">
                {data.recentFailures.length > 0 ? (
                  data.recentFailures.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {f.eventId}
                      </TableCell>
                      <TableCell className="text-red-500 text-xs font-medium">
                        {f.reason}
                      </TableCell>
                      <TableCell className="text-right text-slate-400 text-xs">
                        {f.timestamp}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-4 text-slate-400"
                    >
                      No failures detected.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase text-slate-500">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
