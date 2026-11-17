/** @vitest-environment jsdom */
import {cleanup,render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,it,expect} from "vitest";
import {EmployeePayFields} from "../src/components/employee-pay-fields";

afterEach(()=>cleanup());

describe("EmployeePayFields",()=>{
 it("muestra salario y vacaciones por defecto (mensual)",()=>{
  render(<EmployeePayFields vacationMode="create"/>);
  expect(screen.getByRole("spinbutton",{name:"Salario mensual (CRC)"})).toBeInTheDocument();
  expect(screen.getByRole("spinbutton",{name:/horas ordinarias \/ mes/i})).toBeInTheDocument();
  expect(screen.getByRole("spinbutton",{name:/saldo inicial de vacaciones/i})).toBeInTheDocument();
  expect(screen.getByRole("checkbox",{name:"Exento de CCSS"})).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton",{name:"Precio por hora (CRC)"})).not.toBeInTheDocument();
 });

 it("al marcar pago por horas oculta salario, horas/mes y vacaciones",async()=>{
  const user=userEvent.setup();
  const {container}=render(<EmployeePayFields vacationMode="create"/>);
  const root=within(container);

  await user.click(root.getByRole("checkbox",{name:/pago por horas/i}));

  expect(root.getByRole("spinbutton",{name:/precio por hora/i})).toBeInTheDocument();
  expect(root.queryByRole("spinbutton",{name:/^salario mensual/i})).not.toBeInTheDocument();
  expect(root.queryByRole("spinbutton",{name:/horas ordinarias \/ mes/i})).not.toBeInTheDocument();
  expect(root.queryByRole("spinbutton",{name:/saldo inicial de vacaciones/i})).not.toBeInTheDocument();
  expect(root.getByText(/exento de ccss \(automático/i)).toBeInTheDocument();
  expect(root.queryByRole("checkbox",{name:"Exento de CCSS"})).not.toBeInTheDocument();
 });

 it("en edición por horas no muestra saldo de vacaciones",()=>{
  render(
   <EmployeePayFields
    payByHours
    vacationMode="edit"
    vacationBalance={8}
    hourlyDefault={1500}
    exemptDefault
   />
  );
  expect(screen.queryByDisplayValue(/8 días/i)).not.toBeInTheDocument();
  expect(screen.getByRole("spinbutton",{name:/precio por hora/i})).toBeInTheDocument();
 });

 it("envía hidden exempt_from_ccss=on cuando es por horas",async()=>{
  const user=userEvent.setup();
  const {container}=render(<EmployeePayFields vacationMode="create"/>);
  const root=within(container);
  await user.click(root.getByRole("checkbox",{name:/pago por horas/i}));
  const hidden=container.querySelector('input[name="exempt_from_ccss"]') as HTMLInputElement|null;
  expect(hidden?.type).toBe("hidden");
  expect(hidden?.value).toBe("on");
 });
});
