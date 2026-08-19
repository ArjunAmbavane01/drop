import { motion, useReducedMotion } from "motion/react";
import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EASE_IN_OUT_CUBIC_X1 = 0.4;
const EASE_IN_OUT_CUBIC_Y1 = 0;
const EASE_IN_OUT_CUBIC_X2 = 0.2;
const EASE_IN_OUT_CUBIC_Y2 = 1;

const LABEL_TRANSITION = {
  duration: 0.28,
  ease: [
    EASE_IN_OUT_CUBIC_X1,
    EASE_IN_OUT_CUBIC_Y1,
    EASE_IN_OUT_CUBIC_X2,
    EASE_IN_OUT_CUBIC_Y2,
  ] as [number, number, number, number], // cubic-bezier tuple
};

export interface AnimatedInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  > {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  inputClassName?: string;
  labelClassName?: string;
}

const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  function AnimatedInput(
    {
      value,
      defaultValue = "",
      onChange,
      label,
      className = "",
      inputClassName = "",
      labelClassName = "",
      icon,
      ...inputProps
    },
    ref
  ) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [showPassword, setShowPassword] = useState(false);
    const isControlled = value !== undefined;
    const val = isControlled ? value : internalValue;
    const [isFocused, setIsFocused] = useState(false);
    const isFloating = !!val || isFocused;
    const shouldReduceMotion = useReducedMotion();
    const reactId = useId();
    const inputId = `animated-input-${reactId.replace(/:/g, "")}`;

    const getLabelAnimation = () => {
      if (shouldReduceMotion) {
        return {};
      }
      if (isFloating) {
        return {
          borderColor: "var(--color-brand)",
          color: "var(--color-brand)",
          scale: 0.85,
          y: -24,
        };
      }
      return { color: "#6b7280", scale: 1, y: 0 };
    };

    const getLabelStyle = () => {
      if (!shouldReduceMotion) {
        return {};
      }
      if (isFloating) {
        return {
          borderColor: "var(--color-brand)",
          color: "var(--color-brand)",
          transform: "translateY(-24px) scale(0.85)",
        };
      }
      return {
        color: "#6b7280",
        transform: "translateY(0) scale(1)",
      };
    };

    const isPassword = inputProps.type === "password";

    const inputType = isPassword && showPassword ? "text" : inputProps.type ?? "text";

    return (
      <div className={`relative flex items-center ${className}`}>
        {icon ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-3 -translate-y-1/2"
          >
            {icon}
          </span>
        ) : null}
        <input
          {...inputProps}
          aria-label={label}
          className={cn(
            "peer w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground sm:placeholder:text-transparent",
            icon && "pl-10",
            isPassword && "pr-10",
            inputClassName
          )}
          id={inputId}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => {
            if (!isControlled) {
              setInternalValue(e.target.value);
            }
            onChange?.(e.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={isFloating ? "" : label}
          ref={ref}
          type={inputType}
          value={val}
        />
        {isPassword && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer z-10"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              }
            />
            <TooltipContent>
              {showPassword ? "Hide password" : "Show password"}
            </TooltipContent>
          </Tooltip>
        )}
        <motion.label
          animate={getLabelAnimation()}
          className={`pointer-events-none absolute top-1/2 left-3 origin-left -translate-y-1/2 rounded border border-transparent bg-background px-1 text-foreground transition-all hidden sm:block ${labelClassName}`}
          htmlFor={inputId}
          style={{
            zIndex: 2,
            ...getLabelStyle(),
          }}
          transition={shouldReduceMotion ? { duration: 0 } : LABEL_TRANSITION}
        >
          {label}
        </motion.label>
      </div>
    );
  })

AnimatedInput.displayName = "AnimatedInput";

export default AnimatedInput;