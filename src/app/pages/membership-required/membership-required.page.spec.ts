import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MembershipRequiredPage } from './membership-required.page';

describe('MembershipRequiredPage', () => {
  let component: MembershipRequiredPage;
  let fixture: ComponentFixture<MembershipRequiredPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MembershipRequiredPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
