import 'moment/locale/pl';
import {
    cardinal,
    genderize,
} from 'locale/grammars/polish';

const phrases = {
    'action-badge-add': 'dodaj',
    'action-badge-approve': 'zatwierdź',
    'action-badge-archive': 'zarchiwizuj',
    'action-badge-disable': 'dezaktywuj',
    'action-badge-reactivate': 'reaktywuj',
    'action-badge-remove': 'usuń',
    'action-badge-restore': 'przywróć',

    'activity-chart-legend-branch': 'Nowe gałęzi',
    'activity-chart-legend-issue': 'Zgłoszenia błędu',
    'activity-chart-legend-member': 'Zmiany członkostwa',
    'activity-chart-legend-merge': 'Scalania zmian',
    'activity-chart-legend-merge-request': 'Prośby o połączenie zmian',
    'activity-chart-legend-milestone': 'Kamienie milowe',
    'activity-chart-legend-post': 'Posty',
    'activity-chart-legend-push': 'Wgrywania zmian',
    'activity-chart-legend-repo': 'Zmiany repozytorium',
    'activity-chart-legend-survey': 'Ankiety',
    'activity-chart-legend-tag': 'Tagi',
    'activity-chart-legend-task-list': 'Listy zadań',
    'activity-chart-legend-wiki': 'Edycje strony wiki',

    'activity-tooltip-$count': (count) => {
        return cardinal(count, '1 wiadomość', '2 wiadomości', '5 wiadomości');
    },
    'activity-tooltip-$count-branch': (count) => {
        return cardinal(count, '1 gałąź', '2 gałęzi', '5 gałęzi');
    },
    'activity-tooltip-$count-issue': (count) => {
        return cardinal(count, '1 zgłoszenie blędu', '2 zgłoszenia blędu', '5 zgłoszeń blędu');
    },
    'activity-tooltip-$count-member': (count) => {
        return cardinal(count, '1 zmiana członkostwa', '2 zmiany członkostwa', '5 zmian członkostwa');
    },
    'activity-tooltip-$count-merge': (count) => {
        return cardinal(count, '1 scalnie zmian', '2 scalenia zmian', '5 scaleń zmian');
    },
    'activity-tooltip-$count-merge-request': (count) => {
        return cardinal(count, '1 prośba o połączenie', '2 prośby o połączenie', '5 próśb o połączenie');
    },
    'activity-tooltip-$count-milestone': (count) => {
        return cardinal(count, '1 kamień milowy', '2 kamienie milowe', '5 kamieni milowych');
    },
    'activity-tooltip-$count-post': (count) => {
        return cardinal(count, '1 post', '2 posty', '5 postów');
    },
    'activity-tooltip-$count-push': (count) => {
        return cardinal(count, '1 wgrywanie zmian', '2 wgrywania zmian', '5 wgrywań zmian');
    },
    'activity-tooltip-$count-repo': (count) => {
        return cardinal(count, '1 zmiana repozytorium', '2 zmiany repozytorium', '5 zmian repozytorium');
    },
    'activity-tooltip-$count-survey': (count) => {
        return cardinal(count, '1 ankieta', '2 ankiety', '5 ankiet');
    },
    'activity-tooltip-$count-tag': (count) => {
        return cardinal(count, '1 tag', '2 tagi', '5 tagów');
    },
    'activity-tooltip-$count-task-list': (count) => {
        return cardinal(count, '1 lista zadań', '2 listy zadań', '5 list zadań');
    },
    'activity-tooltip-$count-wiki': (count) => {
        return cardinal(count, '1 edycja strony wiki', '2 edycje strony wiki', '5 edycji strony wiki');
    },

    'app-name': 'Trambar',
    'app-title': 'Trambar - Konsola administracyjna',

    'confirmation-cancel': 'Anuluj',
    'confirmation-confirm': 'Potwierdź',
    'confirmation-data-loss': 'Czy na pewno chcesz porzucić wprowadzone zmiany?',

    'date-range-$start-$end': (start, end) => {
        if (start) {
            if (end) {
                return `${start}–${end}`;
            } else {
                return `${start}–`;
            }
        }
        return '';
    },

    'image-album-cancel': 'Anuluj',
    'image-album-done': 'Ukończ',
    'image-album-manage': 'Zarządzaj albumem',
    'image-album-remove': 'Usuń wybrane',
    'image-album-select': 'Użyj wybranego',
    'image-album-upload': 'Prześlij pliki',

    'image-cropping-cancel': 'Anuluj',
    'image-cropping-select': 'OK',

    'image-selector-choose-from-album': 'Wybierz z albumu',
    'image-selector-crop-image': 'Dostosuj rozmiar/pozycję',
    'image-selector-upload-file': 'Prześlij zdjęcie',

    'member-list-$name-with-$username': (name, username) => {
        if (name) {
            if (username) {
                return `${name} (${username})`;
            } else {
                return name;
            }
        } else {
            return username;
        }
    },
    'member-list-add': 'Dodaj nowego użytkownika',
    'member-list-approve-all': 'Zatwierdź wszystkie prośby',
    'member-list-cancel': 'Anuluj',
    'member-list-edit': 'Zmodyfikuj listę członków',
    'member-list-reject-all': 'Odrzuć wszystkie prośby',
    'member-list-save': 'Zapisz listę członków',
    'member-list-status-non-member': 'Nie jest członkiem',
    'member-list-status-pending': 'Prośba oczekująca na rozpatrzenie',
    'member-list-title': 'Członkowie',

    'nav-member-new': 'Nowy członek',
    'nav-members': 'Członkowie',
    'nav-project-new': 'Nowy projekt',
    'nav-projects': 'Projekty',
    'nav-repositories': 'Repozytoria',
    'nav-role-new': 'Nowa rola',
    'nav-roles': 'Role',
    'nav-server-new': 'Nowy serwer',
    'nav-servers': 'Serwery',
    'nav-settings': 'Ustawienia',
    'nav-user-new': 'Nowy użytkownik',
    'nav-users': 'Użytkownicy',

    'project-list-add': 'Dodaj nowy projekt',
    'project-list-cancel': 'Anuluj',
    'project-list-confirm-archive-$count': (count) => {
        let projects = cardinal(count, 'wybrany projekt', 'te 2 wybrane projekty', 'tych 5 wybranych projektów');
        return `Czy na pewno chcesz zarchiwizować ${projects}?`;
    },
    'project-list-confirm-restore-$count': (count) => {
        let projects = cardinal(count, 'wybrany projekt', 'te 2 wybrane projekty', 'tych 5 wybranych projektów');
        return `Czy na pewno chcesz przywrócić ${projects}?`;
    },
    'project-list-edit': 'Zmodyfikuj listę projektów',
    'project-list-save': 'Zapisz listę projektów',
    'project-list-status-archived': 'Zarchiwizowany',
    'project-list-status-deleted': 'Usunięty',
    'project-list-title': 'Projekty',

    'project-summary-$title': (title) => {
        let text = 'Projekt';
        if (title) {
            text += `: ${title}`;
        }
        return text;
    },
    'project-summary-access-control': 'Kontrola dostępu',
    'project-summary-access-control-member-only': 'Tylko członkowie mogą zobaczyć zawartość projektu',
    'project-summary-access-control-non-member-comment': 'Osoby niebędące członkami mogą komentować',
    'project-summary-access-control-non-member-view': 'Osoby niebędące członkami mogą zobaczyć zawartość projektu',
    'project-summary-add': 'Dodaj nowy projekt',
    'project-summary-archive': 'Zarchiwizuj projekt',
    'project-summary-cancel': 'Anuluj',
    'project-summary-confirm-archive': 'Czy na pewno chcesz zarchiwizować ten projekt?',
    'project-summary-confirm-delete': 'Czy na pewno chcesz usunąć ten projekt?',
    'project-summary-confirm-restore': 'Czy na pewno chcesz przywrócić ten projekt?',
    'project-summary-delete': 'Usuń projekt',
    'project-summary-description': 'Opis',
    'project-summary-edit': 'Zmodyfikuj projekt',
    'project-summary-emblem': 'Emblemat',
    'project-summary-name': 'Identyfikator',
    'project-summary-new-members': 'Nowe członkowie',
    'project-summary-new-members-auto-accept-guest': 'Goście są akceptowani automatycznie',
    'project-summary-new-members-auto-accept-user': 'Zwykli użytkownicy są akceptowani automatycznie',
    'project-summary-new-members-join-guest': 'Goście mogą poprosić o dołączenie do projektu',
    'project-summary-new-members-join-user': 'Zwykli użytkownicy mogą poprosić o dołączenie do projektu',
    'project-summary-new-members-manual': 'Członkowie są dodawani ręcznie',
    'project-summary-other-actions': 'Inne operacje',
    'project-summary-restore': 'Przywróć projekt',
    'project-summary-return': 'Powrót do listy projektów',
    'project-summary-save': 'Zapisz projekt',
    'project-summary-statistics': 'Działania',
    'project-summary-title': 'Nazwa',

    'project-tooltip-$count-others': (count) => {
        return cardinal(count, '1 inny', '2 inne', '5 innych');
    },

    'repo-list-cancel': 'Anuluj',
    'repo-list-confirm-remove-$count': (count) => {
        let repos = cardinal(count, 'wybrane repozytorium', 'te 2 wybrane repozytoria', 'tych 5 wybranych repozytoriów');
        return `Czy na pewno chcesz odłączyć ${repos} od projektu?`;
    },
    'repo-list-edit': 'Zmodyfikuj listę repozytoriów',
    'repo-list-issue-tracker-enabled-false': '',
    'repo-list-issue-tracker-enabled-true': 'Włączony',
    'repo-list-save': 'Zapisz listę repozytoriów',
    'repo-list-title': 'Repozytoria',

    'repo-summary-$title': (title) => {
        let text = `Repozytorium`;
        if (title) {
            text += `: ${title}`;
        }
        return text;
    },
    'repo-summary-cancel': 'Anuluj',
    'repo-summary-confirm-remove': 'Czy na pewno chcesz odłączyć to repozytorium od projektu?',
    'repo-summary-confirm-restore': 'Czy na pewno chcesz ponownie połączyć to repozytorium do projektu?',
    'repo-summary-edit': 'Zmodyfikuj repozytorium',
    'repo-summary-gitlab-name': 'Nazwa projektu GitLaba',
    'repo-summary-issue-tracker': 'Issue-tracker',
    'repo-summary-issue-tracker-disabled': 'Wyłączony',
    'repo-summary-issue-tracker-enabled': 'Włączony',
    'repo-summary-remove': 'Usuń repozytorium',
    'repo-summary-restore': 'Przywróć repozytorium',
    'repo-summary-return': 'Powrót do listy repozytoriów',
    'repo-summary-save': 'Zapisz repozytorium',
    'repo-summary-statistics': 'Działania',
    'repo-summary-title': 'Nazwa',

    'repository-tooltip-$count': (count) => {
        return cardinal(count, '1 repozytorium', '2 repozytoria', '5 repozytoriów');
    },

    'role-list-add': 'Dodaj nową rolę',
    'role-list-cancel': 'Anuluj',
    'role-list-confirm-disable-$count': (count) => {
        let roles = cardinal(count, 'wybraną rolę', 'te 2 wybrane role', 'tych 5 wybranych ról');
        return `Czy na pewno chcesz dezaktywować ${roles}?`;
    },
    'role-list-confirm-reactivate-$count': (count) => {
        let roles = cardinal(count, 'wybraną rolę', 'te 2 wybrane role', 'tych 5 wybranych ról');
        return `Czy na pewno chcesz reaktywować ${roles}?`;
    },
    'role-list-edit': 'Zmodyfikuj listę ról',
    'role-list-save': 'Zapisz listę ról',
    'role-list-status-deleted': 'Usunięta',
    'role-list-status-disabled': 'Nieaktywna',
    'role-list-title': 'Role',

    'role-summary-$title': (title) => {
        let text = 'Rola';
        if (title) {
            text += `: ${title}`;
        }
        return text;
    },
    'role-summary-add': 'Dodaj nową rolę',
    'role-summary-cancel': 'Anuluj',
    'role-summary-confirm-delete': 'Czy na pewno chcesz usunąć tę rolę?',
    'role-summary-confirm-disable': 'Czy na pewno chcesz dezaktywować tę rolę?',
    'role-summary-confirm-reactivate': 'Czy na pewno chcesz reaktywować tę rolę?',
    'role-summary-delete': 'Usuń rolę',
    'role-summary-description': 'Opis',
    'role-summary-disable': 'Dezaktywuj rolę',
    'role-summary-edit': 'Zmodyfikuj rolę',
    'role-summary-name': 'Identyfikator',
    'role-summary-rating': 'Priorytet wiadomości',
    'role-summary-rating-high': 'Wysoki',
    'role-summary-rating-low': 'Niski',
    'role-summary-rating-normal': 'Normalny',
    'role-summary-rating-very-high': 'Bardzo wysoki',
    'role-summary-rating-very-low': 'Bardzo nisk',
    'role-summary-reactivate': 'Reaktywuj rolę',
    'role-summary-return': 'Powrót do listy ról',
    'role-summary-save': 'Zapisz rolę',
    'role-summary-title': 'Nazwa',
    'role-summary-users': 'Użytkownicy',

    'role-tooltip-$count-others': (count) => {
        return cardinal(count, '1 inna', '2 inne', '5 innych');
    },

    'server-list-add': 'Dodaj nowy server',
    'server-list-api-access-false': '',
    'server-list-api-access-true': 'Uzyskany',
    'server-list-cancel': 'Anuluj',
    'server-list-confirm-disable-$count': (count) => {
        let servers = cardinal(count, 'wybrany serwer', 'te 2 wybrane serwery', 'tych 5 wybranych serwerów');
        return `Czy na pewno chcesz wyłączyć ${servers}?`
    },
    'server-list-confirm-reactivate-$count': (count) => {
        let servers = cardinal(count, 'wybrany serwer', 'te 2 wybrane serwery', 'tych 5 wybranych serwerów');
        return `Czy na pewno chcesz reaktywować ${servers}?`
    },
    'server-list-edit': 'Zmodyfikuj listę serwerów',
    'server-list-oauth-false': '',
    'server-list-oauth-true': 'Aktywny',
    'server-list-save': 'Zapisz listę serwerów',
    'server-list-status-deleted': 'Usunięty',
    'server-list-status-disabled': 'Wyłączony',
    'server-list-title': 'Serwery',

    'server-summary-acquire': 'Uzyskaj dostęp API',
    'server-summary-activities': 'Działania',
    'server-summary-add': 'Dodaj nowy serwer',
    'server-summary-api-access': 'Dostęp API',
    'server-summary-api-access-acquired': 'Dostęp administracyjny uzyskany',
    'server-summary-api-access-not-applicable': 'Nie dotyczy',
    'server-summary-api-access-pending': 'Czekając na działania użytkownika',
    'server-summary-cancel': 'Anuluj',
    'server-summary-confirm-delete': 'Czy na pewno chcesz usunąć ten serwer?',
    'server-summary-confirm-disable': 'Czy na pewno chcesz wyłączyć ten serwer?',
    'server-summary-confirm-reactivate': 'Czy na pewno chcesz reaktywować ten serwer?',
    'server-summary-delete': 'Usuń serwer',
    'server-summary-disable': 'Wyłącz serwer',
    'server-summary-edit': 'Zmodyfikuj serwer',
    'server-summary-gitlab-admin': 'Administrator GitLaba',
    'server-summary-gitlab-external-user': 'Zewnętrzny użytkownik GitLaba',
    'server-summary-gitlab-regular-user': 'Zwykły użytkownik GitLaba',
    'server-summary-member-$name': (name) => {
        return `Serwer: ${name}`;
    },
    'server-summary-name': 'Identyfikator',
    'server-summary-new-user': 'Nowy użytkownik',
    'server-summary-new-users': 'Nowi użytkownicy',
    'server-summary-oauth-app-id': 'Identyfikator aplikacji',
    'server-summary-oauth-app-key': 'Klucz aplikacji',
    'server-summary-oauth-app-secret': 'Sekret aplikacji',
    'server-summary-oauth-application-id': 'Identyfikator aplikacji',
    'server-summary-oauth-application-secret': 'Sekret aplikacji',
    'server-summary-oauth-callback-url': 'Zwrotny URL OAuth',
    'server-summary-oauth-client-id': 'Identyfikator klienta',
    'server-summary-oauth-client-secret': 'Sekret klienta',
    'server-summary-oauth-deauthorize-callback-url': 'Zwrotny URL cofnięcia autoryzacji',
    'server-summary-oauth-gitlab-url': 'URL serwera GitLab',
    'server-summary-oauth-redirect-uri': 'Zwrotny URI',
    'server-summary-oauth-redirect-url': 'Zwrotny URL',
    'server-summary-oauth-site-url': 'URL witryny',
    'server-summary-privacy-policy-url': 'URL polityki prywatności',
    'server-summary-reactivate': 'Reaktywuj serwer',
    'server-summary-return': 'Powrót do listy serwerów',
    'server-summary-role-none': 'Nie przypisuj żadnych ról nowym użytkownikom',
    'server-summary-roles': 'Przypisanie ról',
    'server-summary-save': 'Zapisz serwer',
    'server-summary-system-address-missing': 'Adres systemowy nie został ustawiony',
    'server-summary-terms-and-conditions-url': 'URL regulamin',
    'server-summary-test-oauth': 'Przetestuj integrację OAuth',
    'server-summary-title': 'Nazwa',
    'server-summary-type': 'Typ serwera',
    'server-summary-user-automatic-approval': 'Zatwierdź nowych użytkowników automatyczne',
    'server-summary-user-import-disabled': 'Nie rejestruj nowych użytkowników',
    'server-summary-user-import-gitlab-admin-disabled': 'Nie importuj administratorów GitLaba',
    'server-summary-user-import-gitlab-external-user-disabled': 'Nie importuj zewnętrznych użytkowników GitLaba',
    'server-summary-user-import-gitlab-user-disabled': 'Nie importuj użytkowników GitLaba',
    'server-summary-user-type-admin': 'Administrator',
    'server-summary-user-type-guest': 'Gość',
    'server-summary-user-type-moderator': 'Moderator',
    'server-summary-user-type-regular': 'Zwykły użytkownik',
    'server-summary-whitelist': 'Biała lista adresów e-mail',

    'server-type-dropbox': 'Dropbox',
    'server-type-facebook': 'Facebook',
    'server-type-github': 'GitHub',
    'server-type-gitlab': 'GitLab',
    'server-type-google': 'Google',
    'server-type-windows': 'Windows Live',

    'settings-background-image': 'Zdjęcie w tle',
    'settings-cancel': 'Anuluj',
    'settings-company-name': 'Nazwa firmy',
    'settings-edit': 'Zmodyfikuj ustawienia',
    'settings-input-languages': 'Języki wprowadzania',
    'settings-push-relay': 'Przekaźnik notyfikacji push',
    'settings-save': 'Zapisz ustawienia',
    'settings-site-address': 'Adres internetowy',
    'settings-site-description': 'Opis',
    'settings-site-title': 'Nazwa witryny',
    'settings-title': 'Ustawienia',

    'sign-in-$title': (title) => {
        let text = `Zaloguj się`;
        if (title) {
            text += `: ${title}`;
        }
        return text;
    },
    'sign-in-error-access-denied': 'Wniosek o dostęp odrzucono',
    'sign-in-error-account-disabled': 'Konto jest obecnie wyłączone',
    'sign-in-error-existing-users-only': 'Tylko upoważniony personel może uzyskać dostęp do tego systemu',
    'sign-in-error-restricted-area': 'Użytkownik nie jest administratorem',
    'sign-in-oauth': 'Zaloguj się przez OAuth',
    'sign-in-password': 'Hasło:',
    'sign-in-problem-incorrect-username-password': 'Niepoprawna nazwa użytkownika lub hasło',
    'sign-in-problem-no-support-for-username-password': 'System nie akceptuje logowania za pomocą hasła',
    'sign-in-problem-unexpected-error': 'Nieoczekiwany błąd',
    'sign-in-submit': 'Zaloguj się',
    'sign-in-username': 'Nazwa użytkownika:',

    'sign-off-menu-sign-off': 'Wyloguj się',

    'table-heading-api-access': 'Dostęp API',
    'table-heading-date-range': 'Aktywny okres',
    'table-heading-email': 'E-mail',
    'table-heading-issue-tracker': 'Issue-tracker',
    'table-heading-last-modified': 'Zmodyfikowano',
    'table-heading-last-month': 'Zeszłym miesiąc',
    'table-heading-name': 'Imię i nazwisko',
    'table-heading-oauth': 'Autoryzacja OAuth',
    'table-heading-projects': 'Projekty',
    'table-heading-repositories': 'Repozytoria',
    'table-heading-roles': 'Role',
    'table-heading-server': 'Serwery',
    'table-heading-this-month': 'Bieżący miesiąc',
    'table-heading-title': 'Nazwa',
    'table-heading-to-date': 'Do tej pory',
    'table-heading-type': 'Typ',
    'table-heading-username': 'Nazwa użytkownika',
    'table-heading-users': 'Użytkownicy',

    'task-$seconds': (seconds) => {
        return cardinal(seconds, '1 sekunda', '2 sekundy', '5 sekund');
    },
    'task-imported-$count-commit-comments-from-$repo': (count, repo) => {
        let comments = cardinal(count, '1 komentarz rewizji', '2 komentarzy rewizji', '5 komentarzy rewizji');
        return `Zaimportowano ${comments} z projektu „${repo}”`;
    },
    'task-imported-$count-events-from-$repo': (count, repo) => {
        let events = cardinal(count, '1 wydarzenie', '2 wydarzenia', '5 wydarzeń');
        return `Zaimportowano ${events} z projektu „${repo}”`;
    },
    'task-imported-$count-issue-comments-from-$repo': (count, repo) => {
        let comments = cardinal(count, '1 komentarz zgłoszenia błędu', '2 komentarzy zgłoszenia błędu', '5 komentarzy zgłoszenia błędu');
        return `Zaimportowano ${comments} z projektu „${repo}”`;
    },
    'task-imported-$count-merge-request-comments-from-$repo': (count, repo) => {
        let comments = cardinal(count, '1 komentarz prośby o połączenie', '2 komentarzy prośby o połączenie', '5 komentarzy prośby o połączenie');
        return `Zaimportowano ${comments} z „${repo}”`;
    },
    'task-imported-$count-repos': (count) => {
        let repos = cardinal(count, '1 repozytorium', '2 repozytoria', '5 repozytoriów');
        return `Zaimportowano ${repos}`;
    },
    'task-imported-$count-users': (count) => {
        let users = cardinal(count, '1 użytkownika', '2 użytkowników');
        return `Zaimportowano ${users}`;
    },
    'task-imported-push-with-$count-commits-from-$repo-$branch': (count, repo, branch) => {
        let commits = cardinal(count, '1 rewizją', '2 rewizjami', '5 rewizjami');
        return `Zaimportowano wgrywanie z ${commits} do gałęzi „${branch}” projektu „${repo}”`;
    },
    'task-importing-commit-comments-from-$repo': (repo) => {
        return `Importowanie komentarzy rewizji projektu „${repo}”`;
    },
    'task-importing-events-from-$repo': (repo) => {
        return `Importowanie wydarzeń z projektu „${repo}”`;
    },
    'task-importing-issue-comments-from-$repo': (repo) => {
        return `Importowanie komentarzy zgłowszenia błędu z projektu „${repo}”`;
    },
    'task-importing-merge-request-comments-from-$repo': (repo) => {
        return `Importowanie komentarzy prośby o połączenie z projektu „${repo}”`;
    },
    'task-importing-push-from-$repo': (repo) => {
        return `Importowanie wgrywań zmian z projektu „${repo}”`;
    },
    'task-importing-repos': 'Importowanie repozytoriów',
    'task-importing-users': 'Importowanie użytkowników',
    'task-installed-$count-hooks': (count) => {
        let hooks = cardinal(count, '1 hak', '2 haki', '5 haków');
        return `Zainstalowano ${hooks}`;
    },
    'task-installing-hooks': 'Instalowanie haków',
    'task-removed-$count-hooks': (count) => {
        let hooks = cardinal(count, '1 hak', '2 haki', '5 haków');
        return `Odinstalowano ${hooks}`;
    },
    'task-removed-$count-repos': (count) => {
        let repos = cardinal(count, '1 repozytorium', '2 repozytoria', '5 repozytoriów');
        return `Usunięto ${repos}`;
    },
    'task-removed-$count-users': (count) => {
        let users = cardinal(count, '1 użytkownik', '2 użytkowników');
        return `Usunięto ${users}`;
    },
    'task-removing-hooks': 'Odinstalowanie haków',
    'task-updated-$count-repos': (count) => {
        let repos = cardinal(count, '1 repozytorium', '2 repozytoria', '5 repozytoriów');
        return `Zaktualizowano ${repos}`;
    },
    'task-updated-$count-users': (count) => {
        let users = cardinal(count, '1 użytkownik', '2 użytkowników');
        return `Zaktualizowano ${users}`;
    },

    'text-field-placeholder-none': 'brak',

    'tooltip-$first-and-$tooltip': (first, tooltip) => {
        return [ first, ' i ', tooltip ];
    },
    'tooltip-more': 'Więcej',

    'upload-progress-uploading-$count-files-$size-remaining': (count, size) => {
        let files = cardinal(count, '1 płiku', '2 płików');
        return `Przesyłanie ${files}, pozostało ${size}`;
    },

    'user-list-add': 'Dodaj nowego użytkownika',
    'user-list-approve-all': 'Zatwierdź wszystkie prośby',
    'user-list-cancel': 'Anuluj',
    'user-list-confirm-disable-$count': (count) => {
        let accounts = cardinal(count, 'wybrane konto', 'te 2 wybrane konta', 'tych 5 wybranych kont');
        return `Czy na pewno chcesz wyłączyć ${accounts}?`;
    },
    'user-list-confirm-reactivate-$count': (count) => {
        let accounts = cardinal(count, 'wybrane konto', 'te 2 wybrane konta', 'tych 5 wybranych kont');
        return `Czy jesteś pewien, że chcesz reaktywować ${accounts}?`;
    },
    'user-list-edit': 'Zmodyfikuj listę użytkowników',
    'user-list-reject-all': 'Odrzuć wszystkie prośby',
    'user-list-save': 'Zapisz listę użytkowników',
    'user-list-status-deleted': 'Usunięty',
    'user-list-status-disabled': 'Konto Wyłączone',
    'user-list-status-pending': ' Czekając na zatwierdzenie',
    'user-list-title': 'Użytkownicy',
    'user-list-type-admin': 'Administrator',
    'user-list-type-guest': 'Gość',
    'user-list-type-moderator': 'Moderator',
    'user-list-type-regular': 'Zwykły użytkownik',
    'user-summary-$name': (name) => {
        let text = 'Użytkownik';
        if (name) {
            text += `: ${name}`;
        }
        return text;
    },
    'user-summary-add': 'Dodaj nowego użytkownika',
    'user-summary-cancel': 'Anuluj',
    'user-summary-confirm-delete': 'Czy na pewno chcesz usunąć to konto?',
    'user-summary-confirm-disable': 'Czy na pewno chcesz wyłączyć to konto?',
    'user-summary-confirm-reactivate': 'Czy na pewno chcesz reaktywować to konto?',
    'user-summary-delete': 'Usuń konto użytkownika',
    'user-summary-disable': 'Wyłącz konto użytkownika',
    'user-summary-edit': 'Zmodyfikuj użytkownika',
    'user-summary-email': 'E-mail',
    'user-summary-github': 'URL profilu na GitHubie',
    'user-summary-gitlab': 'URL profilu na GitLabie',
    'user-summary-ichat': 'Nazwa użytkownika iChat',
    'user-summary-linkedin': 'URL profilu na LinkedInie',
    'user-summary-member-$name': (name) => {
        let text = 'Członek';
        if (name) {
            text += `: ${name}`;
        }
        return text;
    },
    'user-summary-member-edit': 'Zmodyfikuj członka',
    'user-summary-member-return': 'Powrót do listy członków',
    'user-summary-member-save': 'Zapisz członka',
    'user-summary-name': 'Imię i nazwisko',
    'user-summary-phone': 'Numer telefonu',
    'user-summary-profile-image': 'Zdjęcie profilowe',
    'user-summary-reactivate': 'Reaktywuj konto użytkownika',
    'user-summary-return': 'Powrót do listy użytkowników',
    'user-summary-role-none': 'Żadna',
    'user-summary-roles': 'Role',
    'user-summary-save': 'Zapisz użytkownika',
    'user-summary-skype': 'Nazwa użytkownika Skype',
    'user-summary-slack': 'Identyfikator użytkownika Slack',
    'user-summary-slack-team': 'Identyfikator zespółu Slack',
    'user-summary-social-links': 'Linki społecznościowe',
    'user-summary-stackoverflow': 'URL profilu na StackOverflowie',
    'user-summary-statistics': 'Działania',
    'user-summary-twitter': 'Nazwa użytkownika na Twitterze',
    'user-summary-type': 'Typ użytkownika',
    'user-summary-type-admin': 'Administrator',
    'user-summary-type-guest': 'Gość',
    'user-summary-type-moderator': 'Moderator',
    'user-summary-type-regular': 'Zwykły użytkownik',
    'user-summary-username': 'Nazwa użytkownika',

    'user-tooltip-$count': (count) => {
        return cardinal(count, '1 użytkownik', '2 użytkownicy', '5 użytkowników');
    },

    'validation-duplicate-project-name': 'Projekt z tym identyfikatorem już istnieje',
    'validation-duplicate-role-name': 'Rola z tym identyfikatorem już istnieje',
    'validation-duplicate-server-name': 'Serwer z tym identyfikatorem już istnieje',
    'validation-duplicate-user-name': 'Użytkownik o tej nazwie już istnieje',
    'validation-illegal-project-name': 'Identyfikator projektu nie może być „global”, „admin”, „public” ani „srv”',
    'validation-localhost-is-wrong': '"localhost" jest nieprawidłowy',
    'validation-password-for-admin-only': 'Tylko administratorzy mogą logować się przy użyciu hasła',
    'validation-required': 'Wymagany',

    'welcome': 'Witamy!',
};

export {
    phrases,
    genderize,
};
