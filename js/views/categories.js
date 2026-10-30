/**
 * views/categories.js
 * ---------------------------------------------------------------------------
 * Super Admin: manage the complaint categories students can choose from.
 * Default categories are always available; the admin can add new ones and
 * disable any category (including a default) without deleting history.
 *
 * Route: #/categories
 */

import { el, icon, sectionCard, textInput, emptyState } from '../ui.js';
import { DEFAULT_CATEGORIES } from '../constants.js';
import { subscribeRawCategories, addCategory, setCategoryActive, deleteCategory, categoryDocId } from '../categories.js';
import { friendlyAuthError } from '../utils.js';

export function createCategoriesManager(ctx) {
  let raw = [];
  let unsub = null;

  const panelsHost = el('div', { class: 'grid-2' });

  function entryFor(type, name) {
    const id = categoryDocId(type, name);
    return raw.find((item) => item.id === id);
  }

  function render() {
    panelsHost.replaceChildren(renderPanel('College'), renderPanel('Hostel'));
  }

  function renderPanel(type) {
    const defaults = DEFAULT_CATEGORIES[type];
    const custom = raw.filter((item) => item.type === type && !defaults.includes(item.name));
    const names = [...new Set([...defaults, ...custom.map((c) => c.name)])];

    const addInput = textInput({ id: `new-${type}`, placeholder: `New ${type.toLowerCase()} category` });
    const addButton = el('button', { class: 'btn btn--primary btn--sm', type: 'button' },
      icon('plus', 15), 'Add');
    addButton.addEventListener('click', async () => {
      const value = addInput.value.trim();
      if (!value) return ctx.toast('Enter a category name first.', 'error');
      if (names.some((n) => n.toLowerCase() === value.toLowerCase())) return ctx.toast('That category already exists.', 'warning');
      addButton.disabled = true;
      try {
        await addCategory(type, value);
        addInput.value = '';
        ctx.toast(`"${value}" added to ${type} categories.`, 'success');
      } catch (error) {
        ctx.toast(friendlyAuthError(error), 'error');
      } finally {
        addButton.disabled = false;
      }
    });

    const tags = el('div', { class: 'tag-list' });
    if (!names.length) {
      tags.appendChild(emptyState({ title: 'No categories', message: 'Add the first category below.', iconName: 'tag' }));
    }
    for (const name of names) {
      const entry = entryFor(type, name);
      const enabled = entry ? entry.active !== false : true;
      const isDefault = defaults.includes(name);

      tags.appendChild(
        el('span', { class: `tag ${enabled ? '' : 'tag--off'}` },
          el('span', { text: name }),
          el('button', {
            class: 'btn btn--link btn--sm',
            type: 'button',
            title: enabled ? 'Disable' : 'Enable',
            onclick: async () => {
              try {
                await setCategoryActive(type, name, !enabled);
                ctx.toast(`"${name}" ${enabled ? 'disabled' : 'enabled'}.`, 'success');
              } catch (error) {
                ctx.toast(friendlyAuthError(error), 'error');
              }
            },
          }, enabled ? 'Disable' : 'Enable'),
          !isDefault && entry
            ? el('button', {
                class: 'btn btn--link btn--sm',
                type: 'button',
                style: { color: 'var(--red-600)' },
                onclick: async () => {
                  try {
                    await deleteCategory(entry.id);
                    ctx.toast(`"${name}" removed.`, 'success');
                  } catch (error) {
                    ctx.toast(friendlyAuthError(error), 'error');
                  }
                },
              }, icon('x', 13))
            : null
        )
      );
    }

    return sectionCard({
      title: `${type} maintenance categories`,
      subtitle: `${names.filter((n) => (entryFor(type, n) ? entryFor(type, n).active !== false : true)).length} active of ${names.length}`,
      iconName: type === 'Hostel' ? 'home' : 'building',
      body: el('div', { class: 'stack' },
        tags,
        el('div', { class: 'divider' }),
        el('div', { class: 'input-group' }, el('div', { class: 'field grow' }, addInput), addButton)
      ),
    });
  }

  unsub = subscribeRawCategories(
    (rows) => {
      raw = rows;
      render();
    },
    (error) => ctx.toast(friendlyAuthError(error), 'error')
  );

  return {
    element: el('div', { class: 'stack' },
      el('div', { class: 'notice notice--info' }, icon('tag', 18),
        el('span', { text: 'Disabling a category hides it from new complaint forms. Existing complaints keep their original category.' })),
      panelsHost
    ),
    destroy() {
      if (unsub) unsub();
    },
  };
}
