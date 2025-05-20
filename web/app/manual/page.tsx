"use client";

import {useTheme} from "next-themes";
import React, {useEffect, useState} from "react";

export default function ManualPage() {
  const {resolvedTheme} = useTheme();
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setIframeKey((prevKey) => prevKey + 1);
  }, [resolvedTheme]);

  return (
    <div className="w-full h-full flex-1 bg-white dark:bg-[#191919]">
      <iframe
        key={iframeKey} // Use the key to force re-render
        src="https://v2-embednotion.com/1f70e245d30380128698d5ec4679dc9e"
        style={{
          width: '100%',
          height: '100%',
          background: resolvedTheme === 'dark' ? '#191919' : '#fff',
        }}
      ></iframe>
    </div>
  );
}