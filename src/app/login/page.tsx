import {redirect} from "next/navigation";

/** Ruta pública antigua: ya no muestra el formulario. */
export default function LoginRedirect(){
 redirect("/");
}
