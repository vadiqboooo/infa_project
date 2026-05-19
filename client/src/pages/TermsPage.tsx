import { Link } from "react-router-dom";
import "./PrivacyPage.css";

const SELF_EMPLOYED_INN = import.meta.env.VITE_SELF_EMPLOYED_INN?.trim();

export default function TermsPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <Link className="privacy-back-link" to="/">
          На главную
        </Link>

        <article className="privacy-document">
          <h1>Пользовательское соглашение</h1>

          <h2>1. Общие положения</h2>
          <p className="privacy-paragraph">
            Настоящее пользовательское соглашение определяет условия использования веб-сайта
            https://rancheasy.ru/ и материалов образовательной платформы RanchEasy.
          </p>
          <p className="privacy-paragraph is-indented">
            1.1. Оператор и владелец проекта: Божко Вадим Дмитриевич.
          </p>
          <p className="privacy-paragraph is-indented">
            1.2. Используя сайт, регистрируясь на платформе или оплачивая доступ к материалам,
            Пользователь подтверждает согласие с настоящими условиями.
          </p>

          <h2>2. Описание сервиса</h2>
          <p className="privacy-paragraph">
            RanchEasy предоставляет доступ к образовательным материалам для подготовки к ЕГЭ по
            информатике и математике: заданиям, разборам, домашним работам, пробным вариантам,
            статистике прогресса и дополнительным инструментам обучения.
          </p>
          <p className="privacy-paragraph is-indented">
            2.1. Состав, объем и формат материалов могут изменяться в процессе развития платформы.
          </p>
          <p className="privacy-paragraph is-indented">
            2.2. Платформа помогает в подготовке к экзаменам, но не гарантирует получение
            конкретного балла или результата на ЕГЭ.
          </p>

          <h2>3. Регистрация и аккаунт</h2>
          <p className="privacy-paragraph is-indented">
            3.1. Для доступа к отдельным разделам сайта может потребоваться авторизация.
          </p>
          <p className="privacy-paragraph is-indented">
            3.2. Пользователь отвечает за сохранность доступа к своему аккаунту и не должен
            передавать его третьим лицам.
          </p>
          <p className="privacy-paragraph is-indented">
            3.3. Оператор вправе ограничить доступ к аккаунту при нарушении настоящего соглашения,
            попытках несанкционированного доступа или распространении материалов платформы.
          </p>

          <h2>4. Платные услуги и оплата</h2>
          <p className="privacy-paragraph">
            На сайте могут предоставляться платные образовательные услуги и платный доступ к
            отдельным материалам, курсам, проверкам, консультациям или функциональности платформы.
          </p>
          <p className="privacy-paragraph is-indented">
            4.1. Стоимость, срок и состав платного доступа указываются на сайте, в переписке с
            Пользователем или в платежной форме до оплаты.
          </p>
          <p className="privacy-paragraph is-indented">
            4.2. Доступ считается предоставленным после подтверждения оплаты и технической активации
            соответствующего раздела или услуги.
          </p>
          <p className="privacy-paragraph is-indented">
            4.3. Платежи принимает Божко Вадим Дмитриевич в статусе самозанятого.
          </p>

          <h2>5. Возвраты</h2>
          <p className="privacy-paragraph">
            Вопросы возврата денежных средств рассматриваются индивидуально по обращению
            Пользователя.
          </p>
          <p className="privacy-paragraph is-indented">
            5.1. Для запроса возврата необходимо написать на почту{" "}
            <a href="mailto:vadiqbozhko@gmail.com">vadiqbozhko@gmail.com</a> с указанием контакта,
            даты оплаты и причины обращения.
          </p>
          <p className="privacy-paragraph is-indented">
            5.2. Возврат может быть невозможен, если услуга уже оказана в полном объеме или доступ к
            материалам был предоставлен и использован Пользователем, за исключением случаев,
            предусмотренных законодательством РФ.
          </p>

          <h2>6. Права и обязанности Пользователя</h2>
          <p className="privacy-paragraph is-indented">
            6.1. Пользователь обязуется использовать сайт только законным способом и не нарушать
            работу платформы.
          </p>
          <p className="privacy-paragraph is-indented">
            6.2. Пользователь не вправе копировать, публиковать, продавать, передавать или иным
            образом распространять материалы платформы без письменного разрешения Оператора.
          </p>
          <p className="privacy-paragraph is-indented">
            6.3. Пользователь обязуется предоставлять достоверные контактные данные при обращении,
            регистрации или оплате.
          </p>

          <h2>7. Права и обязанности Оператора</h2>
          <p className="privacy-paragraph is-indented">
            7.1. Оператор обязуется предоставлять доступ к оплаченным материалам и услугам в
            согласованном объеме.
          </p>
          <p className="privacy-paragraph is-indented">
            7.2. Оператор вправе обновлять материалы, изменять интерфейс, добавлять или удалять
            функции платформы без ухудшения уже оплаченного объема услуг.
          </p>
          <p className="privacy-paragraph is-indented">
            7.3. Оператор вправе проводить технические работы, из-за которых сайт или отдельные
            функции могут быть временно недоступны.
          </p>

          <h2>8. Интеллектуальная собственность</h2>
          <p className="privacy-paragraph">
            Все учебные материалы, тексты, разборы, элементы интерфейса, структура заданий и иные
            материалы сайта принадлежат Оператору или используются им на законных основаниях.
          </p>
          <p className="privacy-paragraph is-indented">
            8.1. Пользователь получает право использовать материалы только для личного обучения.
          </p>
          <p className="privacy-paragraph is-indented">
            8.2. Любое коммерческое использование материалов без разрешения Оператора запрещено.
          </p>

          <h2>9. Обработка персональных данных</h2>
          <p className="privacy-paragraph">
            Обработка персональных данных осуществляется в соответствии с Политикой в отношении
            обработки персональных данных, доступной по адресу{" "}
            <Link to="/privacy">https://rancheasy.ru/privacy</Link>.
          </p>

          <h2>10. Связь и обращения</h2>
          <p className="privacy-paragraph">
            По вопросам работы платформы, оплаты, возвратов и доступа к материалам Пользователь
            может обратиться к Оператору:
          </p>
          <p className="privacy-paragraph is-indented">
            — почта: <a href="mailto:vadiqbozhko@gmail.com">vadiqbozhko@gmail.com</a>
          </p>
          <p className="privacy-paragraph is-indented">
            — Telegram:{" "}
            <a href="https://t.me/rancheasy" target="_blank" rel="noreferrer">
              @rancheasy
            </a>
          </p>

          <h2>11. Реквизиты</h2>
          <table className="privacy-purpose-table">
            <tbody>
              <tr>
                <th>Исполнитель</th>
                <td>Божко Вадим Дмитриевич</td>
              </tr>
              <tr>
                <th>Статус</th>
                <td>самозанятый</td>
              </tr>
              {SELF_EMPLOYED_INN ? (
                <tr>
                  <th>ИНН</th>
                  <td>{SELF_EMPLOYED_INN}</td>
                </tr>
              ) : null}
              <tr>
                <th>Почта</th>
                <td>
                  <a href="mailto:vadiqbozhko@gmail.com">vadiqbozhko@gmail.com</a>
                </td>
              </tr>
              <tr>
                <th>Telegram</th>
                <td>
                  <a href="https://t.me/rancheasy" target="_blank" rel="noreferrer">
                    @rancheasy
                  </a>
                </td>
              </tr>
            </tbody>
          </table>

          <h2>12. Заключительные положения</h2>
          <p className="privacy-paragraph is-indented">
            12.1. Оператор вправе изменять настоящее соглашение. Актуальная версия размещается на
            странице https://rancheasy.ru/terms.
          </p>
          <p className="privacy-paragraph is-indented">
            12.2. Продолжение использования сайта после обновления соглашения означает согласие
            Пользователя с новой редакцией.
          </p>
        </article>
      </div>
    </main>
  );
}
