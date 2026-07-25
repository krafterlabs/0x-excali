import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props & { className?: string }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={
        className
          ? className + " overflow-hidden data-[closed]:hidden"
          : "overflow-hidden data-[closed]:hidden"
      }
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
