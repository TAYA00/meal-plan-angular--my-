//  Імпорти бібліотек та модулів
import { Component, OnInit } from '@angular/core'; //ссилаємося до angular для створення його компонентів
import { CommonModule } from '@angular/common'; //ссилаємося до angular для отримання доступу до основних Angular-утиліт
import { HttpClient } from '@angular/common/http'; //ссилаємося до angular для імпорту HttpClient, що використовується для HTTP-запитів
import { Observable } from 'rxjs'; //імпортуємо Observable з rxjs, щоб працювати з асинхронними запитами.

// ОПИС ІНТЕРФЕЙСІВ ДАНИХ

// Визначаємо структуру алергену
interface Allergen {
  Id: string;
  Label: string;
}

//Визначаємо продукт
interface Product {
  ProductId: number;
  Name: string;
  AllergenIds?: string[];
  Price: { Betrag: number };
}

interface Row { 
  Name: string; 
  Days: { Weekday: number; ProductIds: { ProductId: number }[] }[] 
}

interface Day {
  Weekday: number; 
  ProductIds: { ProductId: number }[] ;
}


//Загальна структура отриманих з API даних
interface MealData {
  Allergens: { [key: string]: Allergen }; //Allergens – об'єкт, де ключем є ідентифікатор алергену, а значенням – його опис.
  Products: { [key: string]: Product }; //Products – об'єкт, де ключ – ProductId, а значення – інформація про продукт.
  Rows: { Name: string; Days: { Weekday: number; ProductIds: { ProductId: number }[] }[] }[];
  //Rows – масив об'єктів (ряди), де кожен містить
  // Name – назву страви.
  // Days – масив днів, коли страву подають.
}

//ОПИС ANGULAR КОМПОНЕНТУ

@Component({
  selector: 'app-meal-table', // визначає, під якою назвою можна використовувати компонент у HTML
  // <app-meal-table></app-meal-table> у app.component.html
  standalone: true, //робить компонент самостійним (не вимагає NgModule
  imports: [CommonModule], //підключає CommonModule для використання Angular-директив.
  templateUrl: '../meal-table/meal-table.component.html', //шаблон HTML-коду компонента
  styleUrls: ['../meal-table/meal-table.component.css'] //шаблон стилів компонента
})

//ОПИС КЛАСУ КОМПОНЕНТУ

export class MealTableComponent implements OnInit {
  data!: MealData;
  rows: any[] = [];
  isLoading = true;
  errorMessage = '';
  private apiUrl = 'https://mypreLive.qnips.com/dbapi/ha';
  daysOfWeek: { name: string; date: string }[] = [];
  weekNumber!: number; // 🔹 Variable für KW

  weekdays = [0, 1, 2, 3, 4, 5, 6,];

  //КОНСТРУКТОР недрює HttpClient для виконання HTTP-запитів
  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.fetchMeals().subscribe({
      next: (response) => {
        console.log('Erhaltene Daten:', response);
        if (response) {
          this.data = response as MealData;
          this.rows = this.processMeals(this.data.Rows ?? []);

        }
        this.generateWeekDates();
        this.weekNumber = this.getISOWeek(new Date()); // 🔹 Abfrage der aktuellen Wochennummer
        this.isLoading = false;
      },
      error: (error) => {
        console.error(`Fehler beim Laden: ${error.message}`);
        this.errorMessage = 'Hochladen von Daten nicht möglich';
        this.isLoading = false;
      }
    });
  }

  fetchMeals(): Observable<MealData> {
    return this.http.get<MealData>(this.apiUrl);
  }

  //Перерозподіляє страви з середи (Weekday 2) на інші дні тижня.

  private processMeals(rows: any[]): any[] {
    return rows.map(row => {
      // Фільтруємо всі дні, крім середи (2)
      let updatedDays = row.Days.filter((day: { Weekday: number }) => day.Weekday !== 2);

      //; ProductIds: { ProductId: number }[] }) => day.Weekday !== 2);

      // Отримуємо всі продукти з середи
      const wednesdayData = row.Days.find((day: { Weekday: number }) => day.Weekday === 2);
      if (wednesdayData && wednesdayData.ProductIds?.length > 0) {
        const productsToDistribute = [...wednesdayData.ProductIds]; // Копіюємо список страв

        // Якщо немає інших днів, розподіляємо рівномірно між доступними
        if (updatedDays.length === 0) {
          updatedDays = [
            { Weekday: 0, ProductIds: [] },
            { Weekday: 1, ProductIds: [] },
            { Weekday: 3, ProductIds: [] },
            { Weekday: 4, ProductIds: [] },
            { Weekday: 5, ProductIds: [] },
            { Weekday: 6, ProductIds: [] }
          ];
        }

        // Розподіляємо продукти з середи по інших доступних днях
        productsToDistribute.forEach((product, index) => {
          const targetDay = updatedDays[index % updatedDays.length]; // Вибираємо день по круговому алгоритму
          targetDay.ProductIds.push(product);
        });
      }

      return { ...row, Days: updatedDays };
    });
  }

  private generateWeekDates(): void {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    this.daysOfWeek = days.map((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { name: day, date: date.toLocaleDateString('uk-DE') };
    });
  }

  private getISOWeek(date: Date): number {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const firstThursday = tempDate.getTime();
    tempDate.setMonth(0, 1);
    if (tempDate.getDay() !== 4) {
      tempDate.setMonth(0, 1 + ((4 - tempDate.getDay() + 7) % 7));
    }
    return Math.ceil((firstThursday - tempDate.getTime()) / 604800000) + 1;
  }

  getProducts(weekday: number, row: Row) {
    let productIds = row.Days.find((day) => day.Weekday == weekday)?.ProductIds.map((prod) =>  prod.ProductId)
    let products = productIds?.map((id) =>  this.data.Products[id] )

    return products;
  }

  getAllergenNames(product: Product): string {
    if (!product.AllergenIds || product.AllergenIds.length === 0 || !this.data?.Allergens) {
      return 'Keine Allergene';
    }
    return product.AllergenIds
      .map(aid => this.data.Allergens[aid]?.Label || 'Unbekanntes Allergen')
      .join(', ');
  }

}

