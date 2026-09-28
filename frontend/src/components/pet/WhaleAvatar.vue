<script setup lang="ts">
import { useId } from "vue";
withDefaults(
  defineProps<{ asleep?: boolean; delighted?: boolean; animated?: boolean }>(),
  { animated: true },
);
const id = useId().replace(/:/g, "");
</script>
<template>
  <svg
    class="whale-art"
    :class="{
      'is-asleep': asleep,
      'is-delighted': delighted,
      'is-animated': animated,
    }"
    viewBox="0 0 210 166"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        :id="`${id}-body`"
        x1="45"
        y1="51"
        x2="117"
        y2="149"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#80A9FF" />
        <stop offset=".45" stop-color="#5483F6" />
        <stop offset="1" stop-color="#3D63DD" />
      </linearGradient>
      <linearGradient
        :id="`${id}-belly`"
        x1="77"
        y1="108"
        x2="86"
        y2="153"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#F6FAFF" />
        <stop offset="1" stop-color="#C9DEFF" />
      </linearGradient>
      <clipPath :id="`${id}-clip`">
        <path
          d="M19 101C16 70 42 48 83 48C123 48 147 66 154 100C159 131 133 151 91 153C47 155 22 134 19 101Z"
        />
      </clipPath>
    </defs>
    <ellipse
      class="whale-shadow"
      cx="94"
      cy="159"
      rx="51"
      ry="4"
      fill="#4563A7"
      opacity=".13"
    />
    <g class="whale-float">
      <g class="whale-tail">
        <path
          d="M137 100C156 106 170 100 177 83C158 84 156 69 157 60C168 60 179 65 183 74C184 61 193 55 204 55C208 76 198 87 185 89C181 119 161 132 143 124Z"
          fill="#4A73E4"
        />
        <path
          d="M180 85C184 84 188 80 191 75"
          stroke="#749AFC"
          stroke-width="3"
          stroke-linecap="round"
        />
      </g>
      <path
        d="M19 101C16 70 42 48 83 48C123 48 147 66 154 100C159 131 133 151 91 153C47 155 22 134 19 101Z"
        :fill="`url(#${id}-body)`"
      />
      <g :clip-path="`url(#${id}-clip)`">
        <ellipse cx="81" cy="144" rx="67" ry="29" :fill="`url(#${id}-belly)`" />
        <path
          d="M60 135C64 142 64 146 64 152M78 133C81 141 81 147 80 154M95 134C98 141 98 148 95 154"
          stroke="#B3CDF6"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </g>
      <path
        d="M38 70C48 59 63 56 76 56"
        stroke="#B7D1FF"
        stroke-width="5"
        stroke-linecap="round"
        opacity=".65"
      />
      <path
        class="whale-fin"
        d="M115 114C126 116 137 126 130 135C123 144 110 130 109 120"
        fill="#3D64D7"
      />
      <path
        d="M116 121L126 132"
        stroke="#749AF1"
        stroke-width="2"
        stroke-linecap="round"
      />
      <ellipse cx="42" cy="105" rx="10" ry="5" fill="#FDAAC5" opacity=".55" />
      <ellipse cx="106" cy="105" rx="10" ry="5" fill="#FDAAC5" opacity=".55" />
      <g v-if="!asleep && !delighted" class="whale-eyes">
        <ellipse cx="49" cy="92" rx="4.5" ry="6" fill="#1C315E" />
        <ellipse cx="99" cy="92" rx="4.5" ry="6" fill="#1C315E" />
        <circle cx="50.5" cy="90" r="1.6" fill="white" />
        <circle cx="100.5" cy="90" r="1.6" fill="white" />
      </g>
      <g v-else stroke="#253C6A" stroke-width="3" stroke-linecap="round">
        <path :d="asleep ? 'M43 93Q49 98 55 93' : 'M43 94Q49 86 55 94'" />
        <path :d="asleep ? 'M93 93Q99 98 105 93' : 'M93 94Q99 86 105 94'" />
      </g>
      <path
        d="M66 104Q74 113 83 104"
        stroke="#253C6A"
        stroke-width="2.6"
        stroke-linecap="round"
      />
      <ellipse cx="83" cy="51" rx="5" ry="2" fill="#3B60C6" />
      <g
        v-if="delighted"
        class="whale-splash"
        stroke="#72C9F5"
        stroke-width="4"
        stroke-linecap="round"
      >
        <path d="M83 42V25C83 16 75 13 70 17M84 34C87 20 97 16 101 22" />
        <path d="M62 25L60 29M109 29L112 34M90 9V6" stroke-width="3" />
        <circle cx="72" cy="36" r="2" fill="#9DDCFB" stroke="none" />
        <circle cx="101" cy="42" r="2.5" fill="#9DDCFB" stroke="none" />
      </g>
      <g
        v-if="asleep"
        class="whale-zzz"
        fill="#90A9DF"
        font-family="system-ui,sans-serif"
        font-weight="600"
      >
        <text x="130" y="45" font-size="14">z</text>
        <text x="145" y="31" font-size="19">z</text>
      </g>
    </g>
  </svg>
</template>
<style scoped>
.whale-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.whale-float {
  transform-origin: 48% 72%;
}
.whale-tail {
  transform-origin: 145px 112px;
}
.whale-fin {
  transform-origin: 114px 118px;
}
.whale-eyes {
  transform-origin: 74px 92px;
}
.is-animated .whale-float {
  animation: whale-bob 4s ease-in-out infinite;
}
.is-animated .whale-tail {
  animation: whale-tail 4s ease-in-out infinite;
}
.is-animated .whale-eyes {
  animation: whale-blink 7s infinite;
}
.is-animated .whale-shadow {
  animation: whale-shadow 4s ease-in-out infinite;
  transform-origin: 94px 159px;
}
.is-asleep .whale-float {
  animation-duration: 6s;
}
.is-asleep .whale-tail {
  animation: none;
}
.is-delighted .whale-float {
  animation: whale-delight 0.65s ease-in-out 2;
}
.is-delighted .whale-fin {
  animation: whale-wave 0.35s ease-in-out 4;
}
.whale-splash {
  animation: whale-spray 0.6s ease-out 2;
  transform-origin: 83px 50px;
}
@keyframes whale-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-6px) rotate(1deg);
  }
}
@keyframes whale-tail {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(7deg);
  }
}
@keyframes whale-blink {
  0%,
  43%,
  47%,
  100% {
    transform: scaleY(1);
  }
  45% {
    transform: scaleY(0.1);
  }
}
@keyframes whale-shadow {
  50% {
    transform: scaleX(0.85);
    opacity: 0.08;
  }
}
@keyframes whale-delight {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-10px) rotate(-5deg);
  }
}
@keyframes whale-wave {
  50% {
    transform: rotate(-15deg);
  }
}
@keyframes whale-spray {
  from {
    opacity: 0;
    transform: scaleY(0.3);
  }
  40% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .whale-art * {
    animation: none !important;
  }
}
</style>
