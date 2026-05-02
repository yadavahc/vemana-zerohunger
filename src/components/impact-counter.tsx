import { Card, CardContent } from "@/components/ui/card";

interface ImpactCounterProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}

export function ImpactCounter({ label, value, icon, color = "text-[#1D9E75]" }: ImpactCounterProps) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`text-2xl ${color}`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
