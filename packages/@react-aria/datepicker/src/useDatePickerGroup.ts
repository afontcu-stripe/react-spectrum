import {createFocusManager, getFocusableTreeWalker} from '@react-aria/focus';
import {DateFieldState, DatePickerState, DateRangePickerState} from '@react-stately/datepicker';
import {FocusableElement, KeyboardEvent} from '@react-types/shared';
import {mergeProps} from '@react-aria/utils';
import {RefObject, useMemo} from 'react';
import {useLocale} from '@react-aria/i18n';
import {usePress} from '@react-aria/interactions';

export function useDatePickerGroup(state: DatePickerState | DateRangePickerState | DateFieldState, ref: RefObject<Element>, disableArrowNavigation?: boolean) {
  let {direction} = useLocale();
  let focusManager = useMemo(() => createFocusManager(ref, {accept: node => {
    return node.getAttribute('role') !== 'presentation';
  }}), [ref]);

  // Open the popover on alt + arrow down
  let onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && 'setOpen' in state) {
      e.preventDefault();
      e.stopPropagation();
      state.setOpen(true);
    }

    if (disableArrowNavigation) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        if (direction === 'rtl') {
          focusManager.focusNext();
        } else {
          focusManager.focusPrevious();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        if (direction === 'rtl') {
          focusManager.focusPrevious();
        } else {
          focusManager.focusNext();
        }
        break;
    }
  };

  // Focus the first placeholder segment from the end on mouse down/touch up in the field.
  let focusLast = () => {
    // Try to find the segment prior to the element that was clicked on.
    let target = window.event?.target as FocusableElement;
    let walker = getFocusableTreeWalker(ref.current, {tabbable: true});
    if (target) {
      walker.currentNode = target;
      target = walker.previousNode() as FocusableElement;
    }

    // If no target found, find the last element from the end.
    if (!target) {
      let last: FocusableElement;
      do {
        last = walker.lastChild() as FocusableElement;
        if (last) {
          target = last;
        }
      } while (last);
    }

    // Now go backwards until we find an element that is not a placeholder.
    while (target?.hasAttribute('data-placeholder')) {
      let prev = walker.previousNode() as FocusableElement;
      if (prev && prev.hasAttribute('data-placeholder')) {
        target = prev;
      } else {
        break;
      }
    }

    if (target) {
      target.focus();
    }
  };

  let {pressProps} = usePress({
    preventFocusOnPress: true,
    allowTextSelectionOnPress: true,
    onPressStart(e) {
      if (e.pointerType === 'mouse') {
        focusLast();
      }
    },
    onPress(e) {
      if (e.pointerType !== 'mouse') {
        focusLast();
      }
    }
  });

  return mergeProps(pressProps, {onKeyDown});
}
