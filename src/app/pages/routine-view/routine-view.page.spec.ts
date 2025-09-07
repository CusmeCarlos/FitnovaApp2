import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoutineViewPage } from './routine-view.page';

describe('RoutineViewPage', () => {
  let component: RoutineViewPage;
  let fixture: ComponentFixture<RoutineViewPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RoutineViewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
