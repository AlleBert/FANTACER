"use client";
import type { NextPage } from "next";
import { useMemo, type CSSProperties } from "react";
import Image from "next/image";

export type FrameComponentType = {
  className?: string;
  migliore?: string;

  /** Style props */
  frameDivWidth?: CSSProperties["width"];
  frameDivPadding?: CSSProperties["padding"];
  frameDivMinWidth?: CSSProperties["minWidth"];
};

const FrameComponent: NextPage<FrameComponentType> = ({
  className = "",
  frameDivWidth,
  frameDivPadding,
  frameDivMinWidth,
  migliore,
}) => {
  const frameDivStyle: CSSProperties = useMemo(() => {
    return {
      width: frameDivWidth,
    };
  }, [frameDivWidth]);

  const frameDiv1Style: CSSProperties = useMemo(() => {
    return {
      padding: frameDivPadding,
      minWidth: frameDivMinWidth,
    };
  }, [frameDivPadding, frameDivMinWidth]);

  return (
    <div
      className={`w-[clamp(12rem,50vw,19.044rem)] flex items-start py-[0rem] px-[clamp(0.5rem,2vw,1.062rem)] box-border text-left text-[clamp(2rem,5vw,3.331rem)] text-[#8000ff] font-['Open_Sauce_One'] ${className}`}
      style={frameDivStyle}
    >
      <div className="flex-1 flex items-end gap-[clamp(1.063rem,3vw,2.131rem)] @sm:gap-[1.063rem] @sm:flex-wrap">
        <Image
          className="h-[2.631rem] w-[2.838rem] relative z-[1]"
          width={45}
          height={42}
          sizes="2.838rem"
          alt=""
          src="/Mask-Group2.svg"
        />
        <div
          className="flex-1 flex flex-col items-start justify-end pt-[0rem] px-[0rem] pb-[clamp(0.3rem,1.5vw,0.656rem)] box-border min-w-[7.75rem]"
          style={frameDiv1Style}
        >
          <h2 className="m-0 self-stretch relative text-[length:inherit] tracking-[-3.47px] leading-[clamp(1.875rem,4vw,3.125rem)] font-bold font-[inherit] z-[1] @md:leading-[2.5rem] @md:text-[2.688rem] @sm:leading-[1.875rem] @sm:text-[2rem]">
            {migliore}
          </h2>
        </div>
      </div>
    </div>
  );
};

export default FrameComponent;
