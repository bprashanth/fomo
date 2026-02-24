import { reactive } from 'vue';

/*
 * Simple reactive store to manage user state.
 *
 * Why is this necessary?
 * App.vue is the root component and mounts only once. If we rely solely on
 * localStorage, App.vue won't know when the user logs in (which happens in
 * LoginView.vue) because localStorage is not reactive.
 *
 * By using this reactive store, App.vue can watch `store.user` and immediately
 * update the UI (e.g., showing the data buttons) when the login state changes,
 * without requiring a page refresh.
 */

export const store = reactive({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    joinedData: null,

    setUser(user) {
        this.user = user;
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    },
    setJoinedData(data) {
        this.joinedData = data;
    },
});
