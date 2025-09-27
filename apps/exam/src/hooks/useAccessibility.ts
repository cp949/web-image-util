import { useEffect, useCallback, useRef } from 'react'

interface AccessibilityOptions {
  announcements?: boolean
  keyboardNavigation?: boolean
  focusManagement?: boolean
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const {
    announcements = true,
    keyboardNavigation = true,
    focusManagement = true
  } = options

  const announcementRef = useRef<HTMLDivElement | null>(null)
  // const focusTrapRef = useRef<HTMLElement[]>([])  // 사용되지 않음

  // 스크린 리더 알림 함수
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcements) return

    // 기존 알림 요소 제거
    if (announcementRef.current) {
      document.body.removeChild(announcementRef.current)
    }

    // 새로운 알림 요소 생성
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.setAttribute('role', 'status')
    announcement.className = 'sr-only'
    announcement.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `
    announcement.textContent = message

    document.body.appendChild(announcement)
    announcementRef.current = announcement

    // 1초 후 제거
    setTimeout(() => {
      if (announcement && document.body.contains(announcement)) {
        document.body.removeChild(announcement)
        if (announcementRef.current === announcement) {
          announcementRef.current = null
        }
      }
    }, 1000)
  }, [announcements])

  // 포커스 관리
  const manageFocus = useCallback((element: HTMLElement | null) => {
    if (!focusManagement || !element) return

    element.focus()
    
    // 포커스된 요소가 보이도록 스크롤
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }, [focusManagement])

  // 포커스 트랩 설정
  const setupFocusTrap = useCallback((container: HTMLElement) => {
    if (!focusManagement) return () => {}

    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), details, summary'
    ) as NodeListOf<HTMLElement>

    const firstFocusableElement = focusableElements[0]
    const lastFocusableElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement?.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement?.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    // 초기 포커스 설정
    if (firstFocusableElement) {
      firstFocusableElement.focus()
    }

    // cleanup 함수 반환
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusManagement])

  // 키보드 네비게이션 핸들러
  useEffect(() => {
    if (!keyboardNavigation) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC 키로 모달/다이얼로그 닫기
      if (event.key === 'Escape') {
        // 열린 모달이 있는지 확인
        const openModal = document.querySelector('[role="dialog"][aria-hidden="false"]')
        if (openModal) {
          // 모달 닫기 버튼 찾아서 클릭
          const closeButton = openModal.querySelector('[aria-label*="닫기"], [aria-label*="close"]') as HTMLElement
          closeButton?.click()
        }
      }

      // 스페이스바로 버튼 활성화 (기본 동작이지만 명시적으로 처리)
      if (event.key === ' ' && event.target instanceof HTMLButtonElement) {
        event.preventDefault()
        event.target.click()
      }

      // Enter로 링크 활성화
      if (event.key === 'Enter' && event.target instanceof HTMLAnchorElement) {
        event.preventDefault()
        event.target.click()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [keyboardNavigation])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (announcementRef.current && document.body.contains(announcementRef.current)) {
        document.body.removeChild(announcementRef.current)
      }
    }
  }, [])

  return {
    announceToScreenReader,
    manageFocus,
    setupFocusTrap
  }
}

// 접근성 유틸리티 훅들
export function useSkipLink() {
  const skipToContent = useCallback(() => {
    const mainContent = document.querySelector('main, [role="main"], #main-content')
    if (mainContent instanceof HTMLElement) {
      mainContent.setAttribute('tabindex', '-1')
      mainContent.focus()
      mainContent.addEventListener('blur', () => {
        mainContent.removeAttribute('tabindex')
      }, { once: true })
    }
  }, [])

  return { skipToContent }
}

export function useReducedMotion() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return {
    prefersReducedMotion,
    getTransitionDuration: (normalDuration: number) => 
      prefersReducedMotion ? 0 : normalDuration
  }
}

export function useHighContrast() {
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches

  return {
    prefersHighContrast,
    getContrastColor: (normalColor: string, highContrastColor: string) =>
      prefersHighContrast ? highContrastColor : normalColor
  }
}

// 키보드 네비게이션을 위한 유틸리티
export function useKeyboardNavigation() {
  const handleArrowKeys = useCallback((
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onChange: (newIndex: number) => void
  ) => {
    let newIndex = currentIndex

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        newIndex = (currentIndex + 1) % items.length
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1
        break
      case 'Home':
        event.preventDefault()
        newIndex = 0
        break
      case 'End':
        event.preventDefault()
        newIndex = items.length - 1
        break
      default:
        return
    }

    onChange(newIndex)
    items[newIndex]?.focus()
  }, [])

  return { handleArrowKeys }
}

// 색상 대비 검사 유틸리티
export function checkColorContrast(foreground: string, background: string): {
  ratio: number
  wcagAA: boolean
  wcagAAA: boolean
} {
  // 간단한 색상 대비 계산 (실제 구현에서는 더 정확한 계산 필요)
  const getLuminance = (color: string): number => {
    // RGB 값을 추출하고 상대 휘도 계산
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
    const [r, g, b] = rgb.map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7
  }
}