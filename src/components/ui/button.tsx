import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
type Variant="default"|"outline"|"ghost"|"secondary"|"destructive";
type Size="default"|"sm"|"lg"|"icon";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>{asChild?:boolean;variant?:Variant;size?:Size}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant="default",size="default",asChild=false,...props},ref)=>{
 const Comp:any=asChild?Slot:"button";
 return <Comp ref={ref} className={cn("inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
 variant==="default"&&"bg-primary text-primary-foreground hover:opacity-90",variant==="outline"&&"border bg-background hover:bg-muted",variant==="ghost"&&"hover:bg-muted",variant==="secondary"&&"bg-secondary text-secondary-foreground",variant==="destructive"&&"bg-destructive text-destructive-foreground",
 size==="default"&&"h-9 px-4 py-2",size==="sm"&&"h-8 px-3 text-xs",size==="lg"&&"h-10 px-6",size==="icon"&&"size-9",className)} {...props}/>
}); Button.displayName="Button";