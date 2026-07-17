"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle } from "@backuphub/ui";
import { formatBytes } from "@backuphub/shared";

interface SpaceChartProps {
  usedBytes: number;
  freeBytes: number;
}

export function SpaceChart({ usedBytes, freeBytes }: SpaceChartProps) {
  const total = usedBytes + freeBytes;
  const data = [
    { name: "Usado", value: usedBytes },
    { name: "Disponible", value: freeBytes },
  ];
  const colors = ["hsl(var(--primary))", "hsl(var(--muted))"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Espacio total</CardTitle>
      </CardHeader>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay equipos conectados con datos de espacio.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatBytes(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Usado: {formatBytes(usedBytes)}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              Disponible: {formatBytes(freeBytes)}
            </div>
            <div className="text-muted-foreground">Total: {formatBytes(total)}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
