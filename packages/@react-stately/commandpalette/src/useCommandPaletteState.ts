/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {Collection, FocusStrategy, Node} from '@react-types/shared';
import {CommandPaletteProps, MenuTriggerAction} from '@react-types/commandpalette';
import {ListCollection, useSingleSelectListState} from '@react-stately/list';
import {SelectState} from '@react-stately/select';
import {useControlledState} from '@react-stately/utils';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useMenuTriggerState} from '@react-stately/menu';

export interface CommandPaletteState<T> extends SelectState<T> {
  /** The current value of the combo box input. */
  inputValue: string,
  /** Sets the value of the combo box input. */
  setInputValue(value: string): void,
  /** Selects the currently focused item and updates the input value. */
  commit(): void,
  /** Opens the menu. */
  open(focusStrategy?: FocusStrategy | null, trigger?: MenuTriggerAction): void,
  /** Toggles the menu. */
  toggle(focusStrategy?: FocusStrategy | null, trigger?: MenuTriggerAction): void,
  /** Resets the input value to the previously selected item's text if any and closes the menu.  */
  revert(): void
}

type FilterFn = (textValue: string, inputValue: string) => boolean;

export interface CommandPaletteStateOptions<T> extends CommandPaletteProps<T> {
  /** The filter function used to determine if a option should be included in the combo box list. */
  defaultFilter?: FilterFn
}

/**
 * Provides state management for a combo box component. Handles building a collection
 * of items from props and manages the option selection state of the combo box. In addition, it tracks the input value,
 * focus state, and other properties of the combo box.
 */
export function useCommandPaletteState<T extends object>(props: CommandPaletteStateOptions<T>): CommandPaletteState<T> {
  let {
    defaultFilter,
    menuTrigger = 'input'
  } = props;
  let [showAllItems, setShowAllItems] = useState(false);
  let [isFocused, setFocusedState] = useState(false);
  let [inputValue, setInputValue] = useControlledState(
    props.inputValue,
    props.defaultInputValue ?? '',
    props.onInputChange
  );

  let onSelectionChange = (key) => {
    if (props.onSelectionChange) {
      props.onSelectionChange(key);
    }

    // Since selection occurred, reset input and close
    resetInputValue();
    triggerState.close();
  };

  let {collection, selectionManager, selectedKey, setSelectedKey, selectedItem, disabledKeys} = useSingleSelectListState({
    ...props,
    onSelectionChange,
    items: props.items ?? props.defaultItems
  });

  // Preserve original collection so we can show all items on demand
  let originalCollection = collection;
  let filteredCollection = useMemo(() => (
    // No default filter if items are controlled.
    props.items != null || !defaultFilter
      ? collection
      : filterCollection(collection, inputValue, defaultFilter)
  ), [collection, inputValue, defaultFilter, props.items]);

  // Track what action is attempting to open the menu
  let menuOpenTrigger = useRef('focus' as MenuTriggerAction);
  let onOpenChange = (open: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(open, open ? menuOpenTrigger.current : undefined);
    }
  };

  let triggerState = useMenuTriggerState({...props, onOpenChange, isOpen: undefined, defaultOpen: undefined});
  let open = (focusStrategy?: FocusStrategy, trigger?: MenuTriggerAction) => {
    let displayAllItems = (trigger === 'manual' || (trigger === 'focus' && menuTrigger === 'focus'));
    // Prevent open operations from triggering if there is nothing to display
    // Also prevent open operations from triggering if items are uncontrolled but defaultItems is empty, even if displayAllItems is true.
    // This is to prevent commandpalettees with empty defaultItems from opening but allow controlled items commandpalettees to open even if the inital list is empty (assumption is user will provide swap the empty list with a base list via onOpenChange returning `menuTrigger` manual)
    if (filteredCollection.size > 0 || (displayAllItems && originalCollection.size > 0) || props.items) {
      if (displayAllItems && !triggerState.isOpen && props.items === undefined) {
        // Show all items if menu is manually opened. Only care about this if items are undefined
        setShowAllItems(true);
      }

      menuOpenTrigger.current = trigger;
      triggerState.open(focusStrategy);
    }
  };

  let toggle = (focusStrategy?: FocusStrategy, trigger?: MenuTriggerAction) => {
    // Only update the menuOpenTrigger if menu is currently closed
    if (!triggerState.isOpen) {
      menuOpenTrigger.current = trigger;
    }

    triggerState.toggle(focusStrategy);
  };

  let lastValue = useRef(inputValue);
  
  let resetInputValue = () => {
    setInputValue('');
  };

  useEffect(() => {
    // Reset focused key when the menu closes
    if (!triggerState.isOpen) {
      selectionManager.setFocusedKey(null);
    }
  }, [triggerState.isOpen, selectionManager]);

  // Revert input value and close menu
  let revert = () => {
    commitSelection();
  };

  let commitSelection = () => {
    // If multiple things are controlled, call onSelectionChange
    if (props.selectedKey !== undefined && props.inputValue !== undefined) {
      props.onSelectionChange(selectedKey);

      // Stop menu from reopening from useEffect
      let itemText = collection.getItem(selectedKey)?.textValue ?? '';
      lastValue.current = itemText;
      triggerState.close();
    } else {
      // If only a single aspect of commandpalette is controlled, reset input value and close menu for the user
      resetInputValue();
      triggerState.close();
    }
  };

  let commit = () => {
    if (triggerState.isOpen && selectionManager.focusedKey != null) {
      // Reset inputValue and close menu here if the selected key is already the focused key. Otherwise
      // fire onSelectionChange to allow the application to control the closing.
      if (selectedKey === selectionManager.focusedKey) {
        commitSelection();
      } else {
        setSelectedKey(selectionManager.focusedKey);
      }
    } else {
      // Reset inputValue and close menu if no item is focused but user triggers a commit
      commitSelection();
    }
  };

  let setFocused = (isFocused: boolean) => {
    if (isFocused) {
      if (menuTrigger === 'focus') {
        open(null, 'focus');
      }
    }

    setFocusedState(isFocused);
  };

  return {
    ...triggerState,
    toggle,
    open,
    close: commit,
    selectionManager,
    selectedKey,
    setSelectedKey,
    disabledKeys,
    isFocused,
    setFocused,
    selectedItem,
    collection: showAllItems ? originalCollection : filteredCollection,
    inputValue,
    setInputValue,
    commit,
    revert
  };
}

function filterCollection<T extends object>(collection: Collection<Node<T>>, inputValue: string, filter: FilterFn): Collection<Node<T>> {
  return new ListCollection(filterNodes(collection, inputValue, filter));
}

function filterNodes<T>(nodes: Iterable<Node<T>>, inputValue: string, filter: FilterFn): Iterable<Node<T>> {
  let filteredNode = [];
  for (let node of nodes) {
    if (node.type === 'section' && node.hasChildNodes) {
      let filtered = filterNodes(node.childNodes, inputValue, filter);
      if ([...filtered].length > 0) {
        filteredNode.push({...node, childNodes: filtered});
      }
    } else if (node.type !== 'section' && filter(node.textValue, inputValue)) {
      filteredNode.push({...node});
    }
  }
  return filteredNode;
}
