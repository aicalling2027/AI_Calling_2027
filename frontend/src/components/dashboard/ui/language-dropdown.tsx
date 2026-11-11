"use client";

/**
 * Language picker built on CategoryDropdown. It only maps the language list to
 * dropdown rows: native script as the description, a glyph chip as the leading
 * mark, and one accent per language so the list is easy to scan.
 */

import * as React from "react";

import {
  CategoryDropdown,
  type DropdownOption,
} from "@/components/dashboard/ui/category-dropdown";
import { LANGUAGES, LANGUAGE_META } from "@/content/workspace";

export function languageOptions(
  languages: readonly string[] = LANGUAGES,
): DropdownOption[] {
  return languages.map((language) => {
    const meta = LANGUAGE_META[language];
    return {
      value: language,
      label: language,
      description: meta && meta.native !== language ? meta.native : undefined,
      badge: meta?.badge ?? language.slice(0, 2),
      accent: meta?.accent ?? "#185adb",
    };
  });
}

type SharedProps = {
  label?: string;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  align?: "start" | "end";
  dividerAfter?: number;
  disabled?: boolean;
  id?: string;
  options?: readonly string[];
};

type SingleLanguageProps = SharedProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultipleLanguageProps = SharedProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  footer?: React.ReactNode;
};

export type LanguageDropdownProps = SingleLanguageProps | MultipleLanguageProps;

export function LanguageDropdown(props: LanguageDropdownProps) {
  const {
    options = LANGUAGES,
    label = "Language",
    placeholder = "Choose a language",
    className,
    size,
    align,
    dividerAfter,
    disabled,
    id,
  } = props;

  const items = languageOptions(options);
  const base = {
    options: items,
    label,
    placeholder,
    className,
    size,
    align,
    dividerAfter,
    disabled,
    id,
  };

  if (props.multiple) {
    return (
      <CategoryDropdown
        {...base}
        multiple
        value={props.value}
        onChange={props.onChange}
        footer={props.footer}
      />
    );
  }

  return (
    <CategoryDropdown
      {...base}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
