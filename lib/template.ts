// lib/template.ts

import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { TemplateData } from '@/types/claim';

/**
 * Handlebars 커스텀 헬퍼 등록
 * 템플릿 전역으로 사용할 수 있는 헬퍼 함수 모음
 */
function registerHelpers(): void {
  // 숫자를 한국식 천단위 포맷으로 변환 (예: 1500000 → 1,500,000)
  Handlebars.registerHelper('numberFormat', (value: number) => {
    if (value == null || isNaN(value)) return '-';
    return value.toLocaleString('ko-KR');
  });

  // 날짜를 한국식 포맷으로 변환 (예: 2024-03-15 → 2024년 03월 15일)
  Handlebars.registerHelper('dateFormat', (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${year}년 ${month}월 ${day}일`;
  });

  // 빈 값 처리 (null/undefined → 빈 문자열)
  Handlebars.registerHelper('orEmpty', (value: unknown) => {
    return value ?? '';
  });
}

/**
 * 템플릿 파일을 캐싱하는 Map
 * 운영 환경에서 매 요청마다 디스크 I/O를 방지
 */
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * 템플릿 파일을 읽고 컴파일 (캐시 적용)
 * @param templateName - 템플릿 파일명 (확장자 포함, 예: 'disability-claim-v1.html')
 */
async function loadTemplate(
  templateName: string
): Promise<HandlebarsTemplateDelegate> {
  // 캐시에 존재하면 바로 반환
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const templatePath = path.join(process.cwd(), 'templates', templateName);

  try {
    const source = await fs.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(source);
    templateCache.set(templateName, compiled);
    return compiled;
  } catch (err) {
    throw new Error(
      `템플릿 파일을 찾을 수 없습니다: ${templatePath}\n원인: ${(err as Error).message}`
    );
  }
}

/**
 * 템플릿 이름과 데이터를 받아 HTML 문자열로 렌더링
 * @param templateName - 템플릿 파일명 (예: 'disability-claim-v1.html')
 * @param data         - Handlebars에 전달할 데이터 객체
 * @returns            - 렌더링된 HTML 문자열
 */
export async function renderTemplate<T>(
  templateName: string,
  data: T
): Promise<string> {
  // 헬퍼 등록 (멱등성 보장 - 중복 등록 무시)
  registerHelpers();

  const template = await loadTemplate(templateName);
  return template(data);
}

/**
 * 템플릿 캐시 초기화 (개발 환경의 핫 리로드 또는 테스트 시 사용)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}