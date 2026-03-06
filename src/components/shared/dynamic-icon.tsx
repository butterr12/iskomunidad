import { type LucideProps, icons } from "lucide-react";

function toComponentName(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

interface DynamicIconProps extends Omit<LucideProps, "ref"> {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const componentName = toComponentName(name);
  const Icon = (icons as Record<string, React.ComponentType<LucideProps>>)[componentName];
  if (!Icon) {
    const Fallback = icons.MapPin;
    return <Fallback {...props} />;
  }
  return <Icon {...props} />;
}
