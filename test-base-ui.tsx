import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

export default function Test() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger render={<button className="custom" />}>
        Click me
      </PopoverPrimitive.Trigger>
    </PopoverPrimitive.Root>
  )
}
